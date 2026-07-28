import * as fs from 'fs';
import * as path from 'path';

export function getPythonExecutable(explicitCommand?: string): string {
  const command = explicitCommand?.trim();
  if (command) {
    return command;
  }

  const cwd = process.cwd();
  const venvCandidates = process.platform === 'win32'
    ? [path.join(cwd, '.venv', 'Scripts', 'python.exe')]
    : [path.join(cwd, '.venv', 'bin', 'python')];

  for (const candidate of venvCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (process.platform === 'win32') {
    return 'py';
  }

  return 'python3';
}
