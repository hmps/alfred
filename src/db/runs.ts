import { randomUUID } from 'node:crypto';
import { getDb } from './client';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  job_id: string;
  status: RunStatus;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  tmux_window: string | null;
}

export interface CreateRunInput {
  job_id: string;
}

export function createRun(input: CreateRunInput): Run {
  const db = getDb();
  const id = randomUUID().slice(0, 8);

  const stmt = db.prepare(`
    INSERT INTO runs (id, job_id, status)
    VALUES (?, ?, 'pending')
  `);

  stmt.run(id, input.job_id);

  const run = getRun(id);
  if (!run) {
    throw new Error(`Failed to create run: ${id}`);
  }
  return run;
}

export function getRun(id: string): Run | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM runs WHERE id = ?');
  return stmt.get(id) as Run | undefined;
}

export function getRunsByJobId(jobId: string): Run[] {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM runs WHERE job_id = ? ORDER BY started_at DESC',
  );
  return stmt.all(jobId) as Run[];
}

export function getLatestRun(jobId: string): Run | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM runs
    WHERE job_id = ?
    ORDER BY
      CASE WHEN started_at IS NULL THEN 0 ELSE 1 END DESC,
      started_at DESC
    LIMIT 1
  `);
  return stmt.get(jobId) as Run | undefined;
}

export function getPendingRuns(): Run[] {
  const db = getDb();
  const stmt = db.prepare(
    "SELECT * FROM runs WHERE status = 'pending' ORDER BY rowid ASC",
  );
  return stmt.all() as Run[];
}

export function getRunningRuns(): Run[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM runs WHERE status = 'running'");
  return stmt.all() as Run[];
}

export function getRunsByStatus(status: RunStatus): Run[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM runs WHERE status = ?');
  return stmt.all(status) as Run[];
}

export function countRunsByStatus(): Record<RunStatus, number> {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM runs
    GROUP BY status
  `);
  const rows = stmt.all() as { status: RunStatus; count: number }[];

  const result: Record<RunStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of rows) {
    result[row.status] = row.count;
  }

  return result;
}

export function updateRunStarted(id: string, tmuxWindow: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE runs
    SET status = 'running',
        started_at = datetime('now'),
        tmux_window = ?
    WHERE id = ?
  `);
  stmt.run(tmuxWindow, id);
}

export function updateRunCompleted(id: string, exitCode: number): void {
  const db = getDb();
  const status = exitCode === 0 ? 'completed' : 'failed';
  const stmt = db.prepare(`
    UPDATE runs
    SET status = ?,
        completed_at = datetime('now'),
        exit_code = ?
    WHERE id = ?
  `);
  stmt.run(status, exitCode, id);
}

export function deleteRunsByJobId(jobId: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM runs WHERE job_id = ?');
  stmt.run(jobId);
}
