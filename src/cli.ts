#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { program } from 'commander';
import { addJobCommand } from './commands/add-job';
import { completeCommand } from './commands/complete';
import { initCommand } from './commands/init';
import { listJobsCommand } from './commands/list-jobs';
import { logCommand } from './commands/log';
import { removeJobCommand } from './commands/remove-job';
import { startCommand } from './commands/start';
import { statusCommand } from './commands/status';
import { stopCommand } from './commands/stop';
import { tickCommand } from './commands/tick';
import { runDaemonLoop } from './daemon/loop';
import { initDb } from './db/client';
import { ALFRED_DB_PATH } from './paths';

program
  .name('alfred')
  .description('Personal AI Job Scheduler')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize Alfred (create directories, database, and config)')
  .action(async () => {
    await initCommand();
  });

program
  .command('start')
  .alias('daemon')
  .description('Start the Alfred daemon')
  .action(async () => {
    ensureInitialized();
    await startCommand();
  });

program
  .command('stop')
  .description('Stop the Alfred daemon')
  .action(async () => {
    await stopCommand();
  });

// Internal command for the daemon process (not shown in help)
program.command('_daemon', { hidden: true }).action(async () => {
  ensureInitialized();
  await runDaemonLoop();
});

program
  .command('add-job <name>')
  .description('Add a new job')
  .requiredOption('--command <cmd>', 'Command to run')
  .option('--dir <path>', 'Working directory (default: current directory)')
  .option('--cron <expr>', 'Cron schedule for recurring jobs')
  .option(
    '--at <datetime>',
    'Run once at specific time (HH:MM or ISO datetime)',
  )
  .option('--run-now', 'Queue job to run immediately')
  .action(async (name, options) => {
    ensureInitialized();
    await addJobCommand(name, {
      command: options.command,
      dir: options.dir,
      cron: options.cron,
      at: options.at,
      runNow: options.runNow,
    });
  });

program
  .command('list-jobs')
  .alias('ls')
  .description('List all jobs')
  .action(async () => {
    ensureInitialized();
    await listJobsCommand();
  });

program
  .command('remove-job <job_id>')
  .alias('rm')
  .description('Remove a job and all its runs')
  .action(async (jobId) => {
    ensureInitialized();
    await removeJobCommand(jobId);
  });

program
  .command('status')
  .description('Show current status of jobs and runs')
  .action(async () => {
    ensureInitialized();
    await statusCommand();
  });

program
  .command('tick', { hidden: true })
  .description('Process scheduled jobs (for debugging)')
  .action(async () => {
    ensureInitialized();
    await tickCommand();
  });

program
  .command('log <job_id> [run_id]')
  .description('Show log for a job run')
  .action(async (jobId, runId) => {
    ensureInitialized();
    await logCommand(jobId, runId);
  });

// Internal command for job completion callback (not shown in help)
program
  .command('complete <run_id> <exit_code>', { hidden: true })
  .description('Mark a run as completed (internal)')
  .action(async (runId, exitCode) => {
    ensureInitialized();
    await completeCommand(runId, Number.parseInt(exitCode, 10));
  });

function ensureInitialized(): void {
  if (!existsSync(ALFRED_DB_PATH)) {
    console.error("Error: Alfred is not initialized. Run 'alfred init' first.");
    process.exit(1);
  }
  initDb();
}

program.parse();
