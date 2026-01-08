import { getDb } from './client';

export interface Job {
  id: string;
  name: string;
  working_dir: string;
  command: string;
  schedule_cron: string | null;
  paused: number;
  created_at: string;
  next_run_at: string | null;
}

export interface CreateJobInput {
  name: string;
  working_dir: string;
  command: string;
  schedule_cron?: string | null;
  next_run_at?: string | null;
}

export function createJob(input: CreateJobInput): Job {
  const db = getDb();
  const id = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const stmt = db.prepare(`
    INSERT INTO jobs (id, name, working_dir, command, schedule_cron, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.name,
    input.working_dir,
    input.command,
    input.schedule_cron ?? null,
    input.next_run_at ?? null,
  );

  const job = getJob(id);
  if (!job) {
    throw new Error(`Failed to create job: ${id}`);
  }
  return job;
}

export function getJob(id: string): Job | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
  return stmt.get(id) as Job | undefined;
}

export function getAllJobs(): Job[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
  return stmt.all() as Job[];
}

export function getScheduledJobs(): Job[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM jobs
    WHERE next_run_at IS NOT NULL AND paused = 0
    ORDER BY next_run_at ASC
  `);
  return stmt.all() as Job[];
}

export function getDueJobs(now: string): Job[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM jobs
    WHERE next_run_at IS NOT NULL
      AND next_run_at <= ?
      AND paused = 0
    ORDER BY next_run_at ASC
  `);
  return stmt.all(now) as Job[];
}

export function updateJobNextRun(id: string, nextRunAt: string | null): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE jobs SET next_run_at = ? WHERE id = ?');
  stmt.run(nextRunAt, id);
}

export function pauseJob(id: string, paused: boolean): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE jobs SET paused = ? WHERE id = ?');
  stmt.run(paused ? 1 : 0, id);
}

export function deleteJob(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function jobExists(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('SELECT 1 FROM jobs WHERE id = ?');
  return stmt.get(id) != null;
}
