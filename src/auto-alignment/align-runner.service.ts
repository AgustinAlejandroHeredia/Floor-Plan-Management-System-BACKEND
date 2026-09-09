import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getPythonExecutable } from 'src/utils/python-executable';

export interface AlignmentResult {
  status: string; // ok | weak | footprint | failed | needs_review | manual
  model?: string;
  method?: string;
  matrix_2x3?: number[][];
  scale?: number;
  rotation_deg?: number;
  translation?: [number, number];
  confidence?: number | null;
  rmse?: number | null;
  inliers?: number;
  n_source?: number;
  n_target?: number;
  needs_review?: boolean;
  error?: string;
}

/**
 * Wraps the single Python detector `scripts/align_blueprints.py`, exactly like
 * InferenceDetectionService/ScaleDetectionService wrap theirs: spawn the script,
 * read `<alignment>...</alignment>` JSON from stdout, nothing else. Optional column
 * landmark points (source/target) are handed over as temp JSON files.
 */
@Injectable()
export class AlignRunnerService {
  private readonly logger = new Logger(AlignRunnerService.name);

  // Cap concurrent Python processes so a bulk upload can't fork-bomb the host.
  private running = 0;
  private readonly waiters: Array<() => void> = [];
  private get maxConcurrent(): number {
    return Number(this.configService.get<string>('ALIGN_MAX_CONCURRENT') ?? 2) || 2;
  }

  constructor(private readonly configService: ConfigService) {}

  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise<void>((res) => this.waiters.push(res));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this.waiters.shift()?.();
    }
  }

  async align(
    sourceImagePath: string,
    targetImagePath: string,
    sourcePoints?: number[][],
    targetPoints?: number[][],
    scaleRatio?: number,
    rotationPrior?: number,
  ): Promise<AlignmentResult> {
    const scriptPath = path.join(process.cwd(), 'scripts', 'align_blueprints.py');
    const python = getPythonExecutable(
      this.configService.get<string>('PYTHON_EXECUTABLE'),
    );

    const tmpFiles: string[] = [];
    const writePoints = async (points?: number[][]): Promise<string | null> => {
      if (!points || points.length < 2) return null;
      const p = path.join(os.tmpdir(), `align_pts_${randomUUID()}.json`);
      await fs.writeFile(p, JSON.stringify(points));
      tmpFiles.push(p);
      return p;
    };

    try {
      const srcPtsFile = await writePoints(sourcePoints);
      const dstPtsFile = await writePoints(targetPoints);

      const args = [scriptPath, sourceImagePath, targetImagePath];
      if (srcPtsFile) args.push('--source-points', srcPtsFile);
      if (dstPtsFile) args.push('--target-points', dstPtsFile);
      if (Number.isFinite(scaleRatio)) args.push('--scale-ratio', String(scaleRatio));
      if (Number.isFinite(rotationPrior)) args.push('--rotation-prior', String(rotationPrior));

      const raw = await this.withSlot(() => this.spawnAndCollect(python, args));
      const match = raw.match(/<alignment>([\s\S]*?)<\/alignment>/);
      const jsonStr = match ? match[1].trim() : raw.trim();
      return JSON.parse(jsonStr) as AlignmentResult;
    } finally {
      await Promise.all(
        tmpFiles.map((f) => fs.unlink(f).catch(() => undefined)),
      );
    }
  }

  private spawnAndCollect(
    python: string,
    args: string[],
    timeoutMs = 120_000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(python, args);
      const out: Buffer[] = [];
      const err: Buffer[] = [];

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Alignment process timed out'));
      }, timeoutMs);

      child.stdout.on('data', (c: Buffer) => out.push(c));
      child.stderr.on('data', (c: Buffer) => err.push(c));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        const stdout = Buffer.concat(out).toString('utf8');
        const stderr = Buffer.concat(err).toString('utf8');
        if (code !== 0 && !stdout.includes('<alignment>')) {
          this.logger.error(`align_blueprints.py exited ${code}: ${stderr}`);
          reject(new Error(`Alignment process exited with code ${code}: ${stderr}`));
          return;
        }
        resolve(stdout);
      });
    });
  }
}
