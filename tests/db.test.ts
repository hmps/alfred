import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCHEMA } from '../src/db/schema';

function createTestDb(): { db: Database; cleanup: () => void } {
  const tempDir = mkdtempSync(join(tmpdir(), 'alfred-test-'));
  const dbPath = join(tempDir, 'test.db');
  const db = new Database(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

describe('Database Schema', () => {
  test('creates jobs table with correct columns', () => {
    const { db, cleanup } = createTestDb();
    try {
      const info = db.prepare('PRAGMA table_info(jobs)').all();
      const columns = (info as { name: string }[]).map((c) => c.name);
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('working_dir');
      expect(columns).toContain('command');
      expect(columns).toContain('schedule_cron');
      expect(columns).toContain('next_run_at');
      expect(columns).toContain('paused');
    } finally {
      cleanup();
    }
  });

  test('creates runs table with correct columns', () => {
    const { db, cleanup } = createTestDb();
    try {
      const info = db.prepare('PRAGMA table_info(runs)').all();
      const columns = (info as { name: string }[]).map((c) => c.name);
      expect(columns).toContain('id');
      expect(columns).toContain('job_id');
      expect(columns).toContain('status');
      expect(columns).toContain('started_at');
      expect(columns).toContain('completed_at');
      expect(columns).toContain('exit_code');
      expect(columns).toContain('tmux_window');
    } finally {
      cleanup();
    }
  });
});

describe('Jobs CRUD', () => {
  test('insert and select job', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(`
        INSERT INTO jobs (id, name, working_dir, command)
        VALUES (?, ?, ?, ?)
      `).run('test-job', 'Test Job', '/tmp', 'echo hello');

      const job = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get('test-job') as {
        id: string;
        name: string;
        working_dir: string;
        command: string;
      };

      expect(job.id).toBe('test-job');
      expect(job.name).toBe('Test Job');
      expect(job.working_dir).toBe('/tmp');
      expect(job.command).toBe('echo hello');
    } finally {
      cleanup();
    }
  });

  test('select all jobs', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
      ).run('job1', 'Job 1', '/tmp', 'echo 1');
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
      ).run('job2', 'Job 2', '/tmp', 'echo 2');

      const jobs = db.prepare('SELECT * FROM jobs').all();
      expect(jobs.length).toBe(2);
    } finally {
      cleanup();
    }
  });

  test('filter due jobs by next_run_at', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command, next_run_at) VALUES (?, ?, ?, ?, ?)',
      ).run('past', 'Past', '/tmp', 'echo', '2020-01-01 00:00:00');
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command, next_run_at) VALUES (?, ?, ?, ?, ?)',
      ).run('future', 'Future', '/tmp', 'echo', '2099-01-01 00:00:00');

      const dueJobs = db
        .prepare(
          'SELECT * FROM jobs WHERE next_run_at IS NOT NULL AND next_run_at <= ? AND paused = 0',
        )
        .all('2024-06-01 00:00:00');

      expect(dueJobs.length).toBe(1);
      expect((dueJobs[0] as { id: string }).id).toBe('past');
    } finally {
      cleanup();
    }
  });

  test('update next_run_at', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command, next_run_at) VALUES (?, ?, ?, ?, ?)',
      ).run('update-test', 'Update', '/tmp', 'echo', '2024-01-01 00:00:00');

      db.prepare('UPDATE jobs SET next_run_at = ? WHERE id = ?').run(
        '2025-01-01 00:00:00',
        'update-test',
      );

      const job = db
        .prepare('SELECT next_run_at FROM jobs WHERE id = ?')
        .get('update-test') as {
        next_run_at: string;
      };
      expect(job.next_run_at).toBe('2025-01-01 00:00:00');
    } finally {
      cleanup();
    }
  });

  test('delete job', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
      ).run('delete-me', 'Delete', '/tmp', 'echo');

      const before = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get('delete-me');
      expect(before).toBeDefined();

      db.prepare('DELETE FROM jobs WHERE id = ?').run('delete-me');

      const after = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get('delete-me');
      expect(after).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe('Runs CRUD', () => {
  test('insert and select run', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
      ).run('test-job', 'Test', '/tmp', 'echo');
      db.prepare('INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)').run(
        'run1',
        'test-job',
        'pending',
      );

      const run = db.prepare('SELECT * FROM runs WHERE id = ?').get('run1') as {
        id: string;
        job_id: string;
        status: string;
      };

      expect(run.id).toBe('run1');
      expect(run.job_id).toBe('test-job');
      expect(run.status).toBe('pending');
    } finally {
      cleanup();
    }
  });

  test('filter runs by status', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
      ).run('test-job', 'Test', '/tmp', 'echo');
      db.prepare('INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)').run(
        'run1',
        'test-job',
        'pending',
      );
      db.prepare('INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)').run(
        'run2',
        'test-job',
        'running',
      );
      db.prepare('INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)').run(
        'run3',
        'test-job',
        'completed',
      );

      const pending = db
        .prepare('SELECT * FROM runs WHERE status = ?')
        .all('pending');
      const running = db
        .prepare('SELECT * FROM runs WHERE status = ?')
        .all('running');

      expect(pending.length).toBe(1);
      expect(running.length).toBe(1);
    } finally {
      cleanup();
    }
  });

  test('update run status and exit code', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
      ).run('test-job', 'Test', '/tmp', 'echo');
      db.prepare('INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)').run(
        'run1',
        'test-job',
        'running',
      );

      db.prepare(
        "UPDATE runs SET status = ?, exit_code = ?, completed_at = datetime('now') WHERE id = ?",
      ).run('completed', 0, 'run1');

      const run = db
        .prepare('SELECT status, exit_code FROM runs WHERE id = ?')
        .get('run1') as {
        status: string;
        exit_code: number;
      };

      expect(run.status).toBe('completed');
      expect(run.exit_code).toBe(0);
    } finally {
      cleanup();
    }
  });
});

describe('Cascading delete', () => {
  test('deleting job cascades to runs', () => {
    const { db, cleanup } = createTestDb();
    try {
      db.prepare(
        'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
      ).run('cascade-test', 'Cascade', '/tmp', 'echo');
      db.prepare('INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)').run(
        'run1',
        'cascade-test',
        'pending',
      );
      db.prepare('INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)').run(
        'run2',
        'cascade-test',
        'pending',
      );

      const runsBefore = db
        .prepare('SELECT * FROM runs WHERE job_id = ?')
        .all('cascade-test');
      expect(runsBefore.length).toBe(2);

      db.prepare('DELETE FROM jobs WHERE id = ?').run('cascade-test');

      const runsAfter = db
        .prepare('SELECT * FROM runs WHERE job_id = ?')
        .all('cascade-test');
      expect(runsAfter.length).toBe(0);
    } finally {
      cleanup();
    }
  });
});
