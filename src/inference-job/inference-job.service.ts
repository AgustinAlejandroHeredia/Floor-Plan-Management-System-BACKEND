import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { model, Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import axios from 'axios';

import {
  InferenceJob,
  InferenceJobDocument,
  InferenceJobStatus,
} from './schemas/inference-job.schema';
import { InferenceJobGateway } from './inference-job.gateway';
import {
  Blueprint,
  BlueprintDocument,
} from 'src/blueprint/schemas/blueprint.schema';
import { FileStorageService } from 'src/file-storage/file-storage.service';

interface QueueEntry {
  jobId: string;
  filename: string;
  selectedModels?: string[];
}

interface ModelConfig {
  id: string;
  name: string;
  version: string;
  drive_id: string;
  model_type: string;
}

const TERMINAL_STATUSES = new Set([
  InferenceJobStatus.PROCESSED,
  InferenceJobStatus.ERROR,
  InferenceJobStatus.CANCELLED,
]);

@Injectable()
export class InferenceJobService implements OnModuleInit {
  private readonly pendingQueue: QueueEntry[] = [];
  private readonly activeJobs = new Map<string, AbortController>();
  private readonly maxConcurrent: number;

  constructor(
    @InjectModel(InferenceJob.name)
    private readonly inferenceJobModel: Model<InferenceJobDocument>,
    @InjectModel(Blueprint.name)
    private readonly blueprintModel: Model<BlueprintDocument>,
    private readonly storageService: FileStorageService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => InferenceJobGateway))
    private readonly gateway: InferenceJobGateway,
  ) {
    this.maxConcurrent = this.configService.get<number>(
      'INFERENCE_MAX_CONCURRENT',
      2,
    );
  }

  async onModuleInit(): Promise<void> {
    // Jobs stuck in PROCESSING from a previous server run can never complete.
    await this.inferenceJobModel.updateMany(
      { status: InferenceJobStatus.PROCESSING },
      { status: InferenceJobStatus.ERROR, result: { error: 'Server restarted during processing' } },
    );
  }

  async enqueue(blueprintId: string, selectedModels: string[]): Promise<InferenceJobDocument> {
    const blueprint = await this.blueprintModel
      .findById(blueprintId, { filename: 1 })
      .lean();

    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    if(selectedModels.length === 0) {
      throw new BadRequestException('No selected models provided')
    }

    const job = new this.inferenceJobModel({
      blueprintId: new Types.ObjectId(blueprintId),
      status: InferenceJobStatus.PENDING,
      selectedModels: selectedModels,
      result: null,
    });
    const savedJob = await job.save();

    this.pendingQueue.push({
      jobId: savedJob._id.toString(), 
      filename: blueprint.filename,
      selectedModels: selectedModels,
    });
    this.drainQueue();

    return savedJob;
  }

  async findOne(jobId: string): Promise<InferenceJobDocument> {
    const job = await this.inferenceJobModel.findById(jobId).lean();
    if (!job) {
      throw new NotFoundException('Inference job not found');
    }
    return job;
  }

  async findLatestProcessedForBlueprint(
    blueprintId: string,
  ): Promise<InferenceJobDocument | null> {
    return this.inferenceJobModel
      .findOne({
        blueprintId: new Types.ObjectId(blueprintId),
        status: InferenceJobStatus.PROCESSED,
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async cancel(jobId: string): Promise<void> {
    const job = await this.inferenceJobModel.findById(jobId).lean();
    if (!job) {
      throw new NotFoundException('Inference job not found');
    }

    if (TERMINAL_STATUSES.has(job.status)) {
      throw new ConflictException(`Cannot cancel a job in status: ${job.status}`);
    }

    // Remove from pending queue before it gets picked up by drainQueue.
    const pendingIndex = this.pendingQueue.findIndex(e => e.jobId === jobId);
    if (pendingIndex !== -1) {
      this.pendingQueue.splice(pendingIndex, 1);
      await this.inferenceJobModel.findByIdAndUpdate(jobId, {
        status: InferenceJobStatus.CANCELLED,
      });
      this.gateway.emitJobUpdate(jobId, InferenceJobStatus.CANCELLED, null);
      return;
    }

    // Signal the active job to stop. processJob will update the DB to CANCELLED.
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      return;
    }

    // Edge case: job transitioned to a terminal state between the status read and here.
    // Nothing to do — it will already have a final status in the DB.
  }

  private drainQueue(): void {
    while (
      this.activeJobs.size < this.maxConcurrent &&
      this.pendingQueue.length > 0
    ) {
      const entry = this.pendingQueue.shift()!;
      const controller = new AbortController();
      this.activeJobs.set(entry.jobId, controller);

      this.processJob(entry.jobId, entry.filename, entry.selectedModels!, controller.signal)
        .catch((err: unknown) => {
          console.error(`Inference job ${entry.jobId} failed unexpectedly:`, err);
        })
        .finally(() => {
          this.activeJobs.delete(entry.jobId);
          this.drainQueue();
        });
    }
  }

  private async processJob(
    jobId: string,
    filename: string,
    selectedModels: string[],
    signal: AbortSignal,
  ): Promise<void> {

    await this.inferenceJobModel.findByIdAndUpdate(
      jobId,
      {
        status: InferenceJobStatus.PROCESSING,
      },
    );

    let tempFilePath: string | null = null;

    try {

      signal.throwIfAborted();

      // =====================================================
      // DOWNLOAD IMAGE
      // =====================================================

      const signedUrl =
        await this.storageService.getSignedDownloadUrl(
          filename,
        );

      signal.throwIfAborted();

      const response = await axios.get<Buffer>(
        signedUrl,
        {
          responseType: 'arraybuffer',
          signal,
        },
      );

      const ext =
        path.extname(filename) || '.jpg';

      tempFilePath = path.join(
        os.tmpdir(),
        `inference_${jobId}${ext}`,
      );

      await fs.promises.writeFile(
        tempFilePath,
        response.data,
      );

      signal.throwIfAborted();

      // =====================================================
      // VALIDATE MODELS
      // =====================================================

      if (
        !selectedModels ||
        selectedModels.length === 0
      ) {

        throw new InternalServerErrorException(
          'No selected models provided',
        );
      }

      // =====================================================
      // LOAD models.json
      // =====================================================

      const modelsJsonPath = path.join(
        process.cwd(),
        'models',
        'models.json',
      );

      if (!fs.existsSync(modelsJsonPath)) {

        throw new InternalServerErrorException(
          'models.json not found',
        );
      }

      const raw =
        await fs.promises.readFile(
          modelsJsonPath,
          'utf8',
        );

      const parsed = JSON.parse(raw);

      const availableModels: ModelConfig[] =
        parsed.models;

      // =====================================================
      // STORE RESULTS
      // =====================================================

      const results: Record<string, unknown>[] = [];

      // =====================================================
      // RUN ONE INFERENCE PER MODEL
      // =====================================================

      for (const selectedModel of selectedModels) {

        signal.throwIfAborted();

        const matchedModel =
          availableModels.find(
            (m) =>
              `${m.name} ${m.version}` ===
              selectedModel,
          );

        if (!matchedModel) {

          console.warn(
            `Model not found: ${selectedModel}`,
          );

          continue;
        }

        console.log(
          `Running inference with ${matchedModel.name} ${matchedModel.version}`,
        );

        // =============================================
        // RUN INFERENCE
        // =============================================

        const result =
          await this.runYoloInference(
            tempFilePath,
            matchedModel.model_type,
            matchedModel.id,
            signal,
          );

        results.push(result);

        // =============================================
        // EMIT INDIVIDUAL RESULT
        // =============================================

        this.gateway.emitJobUpdate(
          jobId,
          InferenceJobStatus.PROCESSED,
          result,
        );
      }

      // =====================================================
      // SAVE FINAL RESULTS
      // =====================================================

      await this.inferenceJobModel.findByIdAndUpdate(
        jobId,
        {
          status:
            InferenceJobStatus.PROCESSED,
          result: results,
        },
      );

    } catch (err: unknown) {

      const isAbort =
        signal.aborted ||
        (
          err instanceof Error &&
          (
            err.name === 'AbortError' ||
            err.name === 'CanceledError'
          )
        );

      if (isAbort) {

        await this.inferenceJobModel.findByIdAndUpdate(
          jobId,
          {
            status:
              InferenceJobStatus.CANCELLED,
            result: null,
          },
        );

        this.gateway.emitJobUpdate(
          jobId,
          InferenceJobStatus.CANCELLED,
          null,
        );

        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : 'Unknown error';

      const errorResult = {
        error: message,
      };

      await this.inferenceJobModel.findByIdAndUpdate(
        jobId,
        {
          status:
            InferenceJobStatus.ERROR,
          result: errorResult,
        },
      );

      this.gateway.emitJobUpdate(
        jobId,
        InferenceJobStatus.ERROR,
        errorResult,
      );

    } finally {

      if (tempFilePath) {

        await fs.promises
          .unlink(tempFilePath)
          .catch(() => {});
      }
    }
  }

  private runYoloInference(
    imagePath: string,
    modelType: string,
    modelId: string,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>> {

    return new Promise((resolve, reject) => {

      if (signal.aborted) {
        return reject(signal.reason);
      }

      const scriptPath = path.join(
        process.cwd(),
        'scripts',
        'inference_engine.py',
      );

      const pythonExecutable =
        this.configService.get<string>(
          'PYTHON_EXECUTABLE',
          'python3',
        );

      console.log(
        `Starting YOLO inference: ${pythonExecutable} ${scriptPath} ${imagePath}`,
      );

      const child = spawn(
        pythonExecutable,
        [
          scriptPath,
          imagePath,
          imagePath, // dummy model_path to satisfy engine validation
          modelType,
          modelId,
        ],
      );

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      let exitCode: number | null = null;
      let stdoutEnded = false;
      let stderrEnded = false;
      let processClosed = false;
      let settled = false;

      const settle = (
        fn: () => void,
      ) => {

        if (settled) return;

        settled = true;

        signal.removeEventListener(
          'abort',
          abortHandler,
        );

        fn();
      };

      const tryFinish = () => {

        if (
          !stdoutEnded ||
          !stderrEnded ||
          !processClosed
        ) {
          return;
        }

        if (signal.aborted) {

          settle(() =>
            reject(signal.reason),
          );

          return;
        }

        const stdout =
          Buffer.concat(stdoutChunks)
            .toString('utf8');

        const stderr =
          Buffer.concat(stderrChunks)
            .toString('utf8');

        if (exitCode !== 0) {

          settle(() =>
            reject(
              new Error(
                `YOLO process exited with code ${exitCode}: ${stderr}`,
              ),
            ),
          );

          return;
        }

        try {

          const match = stdout.match(
            /<predictions>([\s\S]*?)<\/predictions>/,
          );

          const jsonStr =
            match
              ? match[1].trim()
              : stdout.trim();

          settle(() =>
            resolve(
              JSON.parse(jsonStr) as Record<string, unknown>,
            ),
          );

        } catch {

          settle(() =>
            reject(
              new Error(
                `Failed to parse YOLO output: ${stdout}`,
              ),
            ),
          );
        }
      };

      const abortHandler = () => {

        child.kill('SIGTERM');

        settle(() =>
          reject(signal.reason),
        );
      };

      signal.addEventListener(
        'abort',
        abortHandler,
        { once: true },
      );

      child.stdout.on(
        'data',
        (chunk: Buffer) =>
          stdoutChunks.push(chunk),
      );

      child.stdout.on(
        'end',
        () => {

          stdoutEnded = true;

          tryFinish();
        },
      );

      child.stderr.on(
        'data',
        (chunk: Buffer) =>
          stderrChunks.push(chunk),
      );

      child.stderr.on(
        'end',
        () => {

          stderrEnded = true;

          tryFinish();
        },
      );

      child.on(
        'close',
        (code) => {

          exitCode = code;

          processClosed = true;

          tryFinish();
        },
      );

      child.on(
        'error',
        (err) =>
          settle(() =>
            reject(err),
          ),
      );
    });
  }

  getAvailableModels() {
    const modelsJsonPath = path.join(
      process.cwd(),
      'models',
      'models.json',
    );

    if (!fs.existsSync(modelsJsonPath)) {
      return {};
    }

    const raw = fs.readFileSync(
      modelsJsonPath,
      'utf8',
    );

    const parsed = JSON.parse(raw);

    // parsed.models viene directamente del models.json
    const models = parsed.models ?? [];

    const groupedModels: Record<string, string[]> = {};

    for (const model of models) {

      const speciality = model.AEC_speciality;

      const modelLabel =
        `${model.name} ${model.version}`;

      if (!groupedModels[speciality]) {
        groupedModels[speciality] = [];
      }

      groupedModels[speciality].push(
        modelLabel,
      );
    }

    // ordenar alfabeticamente dentro de cada especialidad
    for (const speciality of Object.keys(groupedModels)) {

      groupedModels[speciality].sort(
        (a, b) => a.localeCompare(b),
      );
    }

    return groupedModels;
  }
}
