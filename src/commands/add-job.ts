import { resolve } from 'node:path';
import { createJob, jobExists } from '../db/jobs';
import { createRun } from '../db/runs';
import {
  formatDatetime,
  getNextCronTime,
  isValidCron,
  parseAtTime,
} from '../scheduler/cron';

export interface AddJobOptions {
  command: string;
  dir?: string;
  cron?: string;
  at?: string;
  runNow?: boolean;
}

export async function addJobCommand(
  name: string,
  options: AddJobOptions,
): Promise<void> {
  const { command, dir, cron, at, runNow } = options;

  // Validate: must specify when to run
  if (!runNow && !at && !cron) {
    console.error('Error: Must specify when to run the job.');
    console.error('Use --run-now, --at <time>, or --cron <expression>');
    process.exit(1);
  }

  // Validate cron expression
  if (cron && !isValidCron(cron)) {
    console.error(`Error: Invalid cron expression: ${cron}`);
    process.exit(1);
  }

  // Calculate next_run_at
  let nextRunAt: string | null = null;

  if (at) {
    try {
      const atDate = parseAtTime(at);
      nextRunAt = formatDatetime(atDate);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  } else if (cron) {
    const nextDate = getNextCronTime(cron);
    nextRunAt = formatDatetime(nextDate);
  }

  // Resolve working directory
  const workingDir = dir ? resolve(dir) : process.cwd();

  // Generate job ID from name
  const jobId = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check if job already exists
  if (jobExists(jobId)) {
    console.error(`Error: Job '${jobId}' already exists.`);
    process.exit(1);
  }

  // Create the job
  const job = createJob({
    name,
    working_dir: workingDir,
    command,
    schedule_cron: cron ?? null,
    next_run_at: nextRunAt,
  });

  console.log(`Created job '${job.id}'`);
  console.log(`  Command: ${command}`);
  console.log(`  Working dir: ${workingDir}`);

  if (cron) {
    console.log(`  Schedule: ${cron}`);
    console.log(`  Next run: ${nextRunAt}`);
  } else if (at) {
    console.log(`  Scheduled for: ${nextRunAt}`);
  }

  // If --run-now, create a pending run immediately
  if (runNow) {
    const run = createRun({ job_id: job.id });
    console.log(`  Queued run: ${run.id} (pending)`);
  }
}
