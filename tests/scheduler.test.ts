import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCHEMA } from '../src/db/schema';

function createTestDb(): { db: Database; cleanup: () => void } {
  const tempDir = mkdtempSync(join(tmpdir(), 'alfred-scheduler-test-'));
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

describe('Scheduler logic', () => {
  describe('Job scheduling simulation', () => {
    test('cron job keeps schedule after triggering', () => {
      const { db, cleanup } = createTestDb();
      try {
        db.prepare(
          'INSERT INTO jobs (id, name, working_dir, command, schedule_cron, next_run_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
          'cron-job',
          'Cron Job',
          '/tmp',
          'echo cron',
          '* * * * *',
          '2024-01-01 00:00:00',
        );

        const job = db
          .prepare('SELECT * FROM jobs WHERE id = ?')
          .get('cron-job') as {
          schedule_cron: string;
          next_run_at: string;
        };

        expect(job.schedule_cron).toBe('* * * * *');
        expect(job.next_run_at).toBe('2024-01-01 00:00:00');

        db.prepare('UPDATE jobs SET next_run_at = ? WHERE id = ?').run(
          '2024-01-01 00:01:00',
          'cron-job',
        );

        const updated = db
          .prepare('SELECT next_run_at FROM jobs WHERE id = ?')
          .get('cron-job') as {
          next_run_at: string;
        };
        expect(updated.next_run_at).toBe('2024-01-01 00:01:00');
      } finally {
        cleanup();
      }
    });

    test('one-off job clears next_run_at after triggering', () => {
      const { db, cleanup } = createTestDb();
      try {
        db.prepare(
          'INSERT INTO jobs (id, name, working_dir, command, next_run_at) VALUES (?, ?, ?, ?, ?)',
        ).run('one-off', 'One Off', '/tmp', 'echo once', '2024-01-01 00:00:00');

        db.prepare('UPDATE jobs SET next_run_at = NULL WHERE id = ?').run(
          'one-off',
        );

        const job = db
          .prepare('SELECT next_run_at FROM jobs WHERE id = ?')
          .get('one-off') as {
          next_run_at: string | null;
        };
        expect(job.next_run_at).toBeNull();
      } finally {
        cleanup();
      }
    });
  });

  describe('Run lifecycle simulation', () => {
    test('run transitions through states', () => {
      const { db, cleanup } = createTestDb();
      try {
        db.prepare(
          'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
        ).run('lifecycle', 'Lifecycle', '/tmp', 'echo');

        db.prepare(
          'INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)',
        ).run('run1', 'lifecycle', 'pending');

        let run = db
          .prepare('SELECT status FROM runs WHERE id = ?')
          .get('run1') as {
          status: string;
        };
        expect(run.status).toBe('pending');

        db.prepare(
          "UPDATE runs SET status = 'running', started_at = datetime('now'), tmux_window = ? WHERE id = ?",
        ).run('window-1', 'run1');

        run = db
          .prepare('SELECT status, tmux_window FROM runs WHERE id = ?')
          .get('run1') as {
          status: string;
          tmux_window: string;
        };
        expect(run.status).toBe('running');
        expect(run.tmux_window).toBe('window-1');

        db.prepare(
          "UPDATE runs SET status = 'completed', completed_at = datetime('now'), exit_code = 0 WHERE id = ?",
        ).run('run1');

        run = db
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

    test('pending runs ordered by rowid', () => {
      const { db, cleanup } = createTestDb();
      try {
        db.prepare(
          'INSERT INTO jobs (id, name, working_dir, command) VALUES (?, ?, ?, ?)',
        ).run('order-test', 'Order', '/tmp', 'echo');

        db.prepare(
          'INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)',
        ).run('run-a', 'order-test', 'pending');
        db.prepare(
          'INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)',
        ).run('run-b', 'order-test', 'pending');
        db.prepare(
          'INSERT INTO runs (id, job_id, status) VALUES (?, ?, ?)',
        ).run('run-c', 'order-test', 'pending');

        const pending = db
          .prepare(
            "SELECT id FROM runs WHERE status = 'pending' ORDER BY rowid ASC",
          )
          .all() as { id: string }[];

        expect(pending.length).toBe(3);
        expect(pending[0].id).toBe('run-a');
        expect(pending[1].id).toBe('run-b');
        expect(pending[2].id).toBe('run-c');
      } finally {
        cleanup();
      }
    });
  });
});
