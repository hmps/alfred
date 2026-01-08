import { existsSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { ALFRED_DAEMON_LOG } from '../paths';

const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_BACKUP_FILES = 1;

/**
 * Rotate log file if it exceeds max size
 * Keeps one backup: daemon.log -> daemon.log.1
 */
export function rotateLogIfNeeded(): void {
  if (!existsSync(ALFRED_DAEMON_LOG)) {
    return;
  }

  const stats = statSync(ALFRED_DAEMON_LOG);
  if (stats.size < MAX_LOG_SIZE) {
    return;
  }

  // Remove old backup if it exists
  const backupPath = `${ALFRED_DAEMON_LOG}.1`;
  if (existsSync(backupPath)) {
    unlinkSync(backupPath);
  }

  // Rotate current log to backup
  renameSync(ALFRED_DAEMON_LOG, backupPath);
}

/**
 * Log a message to stdout (which is redirected to daemon.log)
 */
export function daemonLog(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}
