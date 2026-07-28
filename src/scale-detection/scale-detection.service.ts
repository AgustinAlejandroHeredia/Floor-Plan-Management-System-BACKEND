import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { getPythonExecutable } from 'src/utils/python-executable';

export interface ScaleDetectionResult {
  scale: number | null;
  model_loaded: boolean;
}

@Injectable()
export class ScaleDetectionService {
  detectScale(imagePath: string): Promise<ScaleDetectionResult> {
    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'detect_scale.py');
      const pythonExecutable = getPythonExecutable(process.env.PYTHON_EXECUTABLE);

      const child = spawn(pythonExecutable, [scriptPath, imagePath]);
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      child.on('close', () => {
        const stderr = Buffer.concat(stderrChunks).toString('utf8');
        if (stderr) {
          console.log('[scale_orientation_detector stderr]', stderr);
        }

        const modelLoaded = /Modelo|Model found in cache|Downloaded model|Modelo \'/.test(stderr);
        const stdout = Buffer.concat(stdoutChunks).toString('utf8');

        try {
          const match = stdout.match(/<scale_orientation>([\s\S]*?)<\/scale_orientation>/);
          if (!match) {
            resolve({ scale: null, model_loaded: modelLoaded });
            return;
          }

          const parsed = JSON.parse(match[1].trim()) as { scale: number | null; orientation: number | null };
          resolve({ scale: parsed.scale ?? null, model_loaded: modelLoaded });
        } catch {
          resolve({ scale: null, model_loaded: modelLoaded });
        }
      });

      child.on('error', (err) => {
        console.warn('[scale_orientation_detector] spawn error:', err);
        resolve({ scale: null, model_loaded: false });
      });
    });
  }
}
