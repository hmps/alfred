export const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  command TEXT NOT NULL,
  schedule_cron TEXT,
  paused INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  next_run_at TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  exit_code INTEGER,
  tmux_window TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON jobs(next_run_at) WHERE next_run_at IS NOT NULL AND paused = 0;
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_job_id ON runs(job_id);
`;
