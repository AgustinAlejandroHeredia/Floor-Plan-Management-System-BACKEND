import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { InferenceDetectionService } from './inference-detection.service';
import {
  Blueprint,
  BlueprintDocument,
} from 'src/blueprint/schemas/blueprint.schema';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { UserRole } from 'src/user/common/role.enum';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActionType } from 'src/activity-logs/common/types';
import { UpdateSectionViewsDto } from 'src/blueprint/dto/update-section-views';

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
    private readonly organizationMembershipService: OrganizationMembershipService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly inferenceDetectionService: InferenceDetectionService,
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

  async enqueue(
    blueprintId: string, 
    selectedModels: string[],
    userId: string,
    userGlobalRole: string,
  ): Promise<InferenceJobDocument> {
    const blueprint = await this.blueprintModel
      .findById(
        blueprintId,
        {
          filename: 1,
          organizationId: 1,
          blueprintName: 1,
        },
      )
      .lean()

    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

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

    // ACTIVITY LOG
    this.activityLogsService.create(userId, {
      action: ActionType.ENQUEUE_INFERENCE_JOB,
      description: `Enqueued inference job for blueprint "${blueprint.blueprintName}" with wht next models: ${selectedModels.toString()}.`,
      targetName: "new inference job",
      targetId: `${savedJob.id}`,
      fields: [
        {key:'blueprintName', value:blueprint.blueprintName},
        {key:'models', value:selectedModels.toString()}
      ]
    })

    return savedJob;
  }

  async findOne(
    jobId: string,
    userId: string,
    userGlobalRole: string,
  ): Promise<InferenceJobDocument> {

    const job = await this.inferenceJobModel.findById(jobId).lean();
    if (!job) {
      throw new NotFoundException('Inference job not found');
    }

    const blueprintId = job.blueprintId

    const blueprint = await this.blueprintModel.findById(new Types.ObjectId(blueprintId))
    if(!blueprint){
      throw new NotFoundException("original blueprint not found")
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

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

  async cancel(
    jobId: string,
    userId: string,
    userGlobalRole: string,
  ): Promise<void> {
    const job = await this.inferenceJobModel.findById(jobId).lean();
    if (!job) {
      throw new NotFoundException('Inference job not found');
    }

    const blueprintId = job.blueprintId

    const blueprint = await this.blueprintModel.findById(new Types.ObjectId(blueprintId))
    if(!blueprint){
      throw new NotFoundException("original blueprint not found")
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

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

    // ACTIVITY LOG
    this.activityLogsService.create(userId, {
      action: ActionType.CANCEL_INFERENCE_JOB,
      description: `Canceled inference job for blueprint "${blueprint.blueprintName}".`,
      targetName: "cancel inference job",
      targetId: "jobId.id",
      fields: [
        {key:'blueprintName', value:blueprint.blueprintName}
      ]
    })

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

      const rawBuffer = Buffer.from(response.data);
      // Detect WebP by magic bytes (RIFF....WEBP) regardless of stored filename extension,
      // since storage providers may have converted the image to WebP for compression.
      const isWebP =
        rawBuffer.length >= 12 &&
        rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        rawBuffer.subarray(8, 12).toString('ascii') === 'WEBP';

      const ext = isWebP ? '.webp' : (path.extname(filename) || '.jpg');

      tempFilePath = path.join(
        os.tmpdir(),
        `inference_${jobId}${ext}`,
      );

      await fs.promises.writeFile(
        tempFilePath,
        rawBuffer,
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
        'src',
        'data',
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
          await this.inferenceDetectionService.detect(
            tempFilePath,
            matchedModel.model_type,
            matchedModel.id,
            signal,
          );

        results.push({
          modelId: matchedModel.id,
          modelName: `${matchedModel.name} ${matchedModel.version}`,
          ...result,
        });
      }

      // =====================================================
      // SAVE FINAL RESULTS
      // =====================================================

      const updatedJob = await this.inferenceJobModel.findByIdAndUpdate(
        jobId,
        {
          status:
            InferenceJobStatus.PROCESSED,
          result: results,
        },
        {
          new: true,
        },
      );

      if(!updatedJob){
        throw new Error('update failed')
      }

      const aggregatedPredictions = updatedJob.result!.flatMap(
        (modelResult: any) => modelResult?.predictions ?? [],
      );

      const modelSummaries = updatedJob.result!.map(
        (modelResult: any) => ({
          modelId: modelResult?.modelId ?? null,
          modelName: modelResult?.modelName ?? 'Unknown model',
          count: Array.isArray(modelResult?.predictions)
            ? modelResult.predictions.length
            : 0,
        }),
      );

      const dto: UpdateSectionViewsDto = {
        sectionViews: aggregatedPredictions.map(prediction => ({
          type: 'rectangle',

          coordsList: [
            {
              x: prediction.bbox.x - prediction.bbox.width / 2,
              y: prediction.bbox.y - prediction.bbox.height / 2,
            },
            {
              x: prediction.bbox.x + prediction.bbox.width / 2,
              y: prediction.bbox.y + prediction.bbox.height / 2,
            },
          ],

          size: {
            width: prediction.bbox.width,
            height: prediction.bbox.height,
          },

          label: prediction.class,
          confidence: prediction.confidence,
        })),
      }

      await this.blueprintModel.findByIdAndUpdate(
        new Types.ObjectId(updatedJob!.blueprintId),
        {
          sectionViews: dto.sectionViews,
        },
      )

      // =====================================================
      // EMIT FINAL RESULT
      // Emitted once, after every selected model has finished,
      // with predictions aggregated across all of them - not
      // per-model, so multi-model jobs don't resolve early on
      // the frontend and lose every model after the first.
      // =====================================================

      this.gateway.emitJobUpdate(
        jobId,
        InferenceJobStatus.PROCESSED,
        { predictions: aggregatedPredictions, modelSummaries },
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

  getAvailableModels() {
    const modelsJsonPath = path.join(
      process.cwd(),
      'src',
      'data',
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
