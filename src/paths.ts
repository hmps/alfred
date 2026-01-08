import { homedir } from 'node:os';
import { join } from 'node:path';

export const ALFRED_DIR = join(homedir(), '.alfred');
export const ALFRED_DB_PATH = join(ALFRED_DIR, 'alfred.db');
export const ALFRED_LOGS_DIR = join(ALFRED_DIR, 'logs');
export const ALFRED_CONFIG_DIR = join(homedir(), '.config', 'alfred');
export const ALFRED_CONFIG_PATH = join(ALFRED_CONFIG_DIR, 'config.yaml');
export const ALFRED_TICK_LOG = join(ALFRED_DIR, 'tick.log');
export const ALFRED_PID_PATH = join(ALFRED_DIR, 'daemon.pid');
export const ALFRED_DAEMON_LOG = join(ALFRED_DIR, 'daemon.log');

export function getLogPath(jobId: string, runId: string): string {
  return join(ALFRED_LOGS_DIR, `${jobId}-${runId}.log`);
}

export function getExitCodePath(jobId: string, runId: string): string {
  return join(ALFRED_LOGS_DIR, `${jobId}-${runId}.exit`);
}
