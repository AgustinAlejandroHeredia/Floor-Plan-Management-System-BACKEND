import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as path from 'path';
import { getPythonExecutable } from 'src/utils/python-executable';

/**
 * Runs the YOLO/SAHI segmentation model (inference_engine.py) for a single
 * specialty model against a single image. One peer alongside
 * ScaleDetectionService and OrientationDetectionService - each wraps exactly
 * one Python detector and nothing else. Job orchestration (queueing,
 * looping over selected models, persisting/aggregating results, notifying
 * clients) stays in InferenceJobService, which calls detect() once per
 * selected model.
 */
@Injectable()
export class InferenceDetectionService {
  constructor(private readonly configService: ConfigService) {}

  detect(
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

      const pythonExecutable = getPythonExecutable(
        this.configService.get<string>('PYTHON_EXECUTABLE'),
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
}
