import { existsSync, readFileSync } from 'node:fs';
import { loadConfig } from '../config';
import { getDueJobs, getJob, updateJobNextRun } from '../db/jobs';
import {
  createRun,
  getPendingRuns,
  getRunningRuns,
  updateRunCompleted,
  updateRunStarted,
} from '../db/runs';
import { getExitCodePath } from '../paths';
import { spawnJob } from '../runner/spawn';
import { tmuxWindowExists } from '../runner/tmux';
import { formatDatetime, getNextCronTime } from './cron';

export async function tick(): Promise<void> {
  const now = new Date();
  const nowStr = formatDatetime(now);

  console.log(`[${nowStr}] Running tick...`);

  // Step 1: Queue due jobs
  await queueDueJobs(nowStr);

  // Step 2: Check running jobs for completion
  await checkRunningJobs();

  // Step 3: Spawn pending jobs (up to max_parallel)
  await spawnPendingJobs();

  console.log(`[${nowStr}] Tick complete.`);
}

async function queueDueJobs(nowStr: string): Promise<void> {
  const dueJobs = getDueJobs(nowStr);

  for (const job of dueJobs) {
    // Create a new pending run
    const run = createRun({ job_id: job.id });
    console.log(`  Queued run ${run.id} for job ${job.id}`);

    // Update next_run_at
    if (job.schedule_cron) {
      // Recurring job: calculate next occurrence
      const nextTime = getNextCronTime(job.schedule_cron);
      updateJobNextRun(job.id, formatDatetime(nextTime));
    } else {
      // One-off job: clear next_run_at
      updateJobNextRun(job.id, null);
    }
  }
}

async function checkRunningJobs(): Promise<void> {
  const config = await loadConfig();
  const session = config.tmux_session;
  const runningRuns = getRunningRuns();

  for (const run of runningRuns) {
    if (!run.tmux_window) continue;

    // Check if window still exists
    const windowExists = await tmuxWindowExists(session, run.tmux_window);

    if (!windowExists) {
      // Window is gone, check exit code
      const job = getJob(run.job_id);
      if (!job) continue;

      const exitCodePath = getExitCodePath(job.id, run.id);

      if (existsSync(exitCodePath)) {
        const exitCodeStr = readFileSync(exitCodePath, 'utf-8').trim();
        const exitCode = Number.parseInt(exitCodeStr, 10);
        updateRunCompleted(run.id, Number.isNaN(exitCode) ? 1 : exitCode);
        console.log(`  Run ${run.id} completed with exit code ${exitCode}`);
      } else {
        // No exit code file, assume failed
        updateRunCompleted(run.id, 1);
        console.log(`  Run ${run.id} completed (no exit code, assumed failed)`);
      }
    }
  }
}

async function spawnPendingJobs(): Promise<void> {
  const config = await loadConfig();
  const maxParallel = config.max_parallel;

  // Count current running jobs
  const runningCount = getRunningRuns().length;
  const availableSlots = maxParallel - runningCount;

  if (availableSlots <= 0) {
    console.log(`  Max parallel jobs (${maxParallel}) reached, waiting...`);
    return;
  }

  // Get pending runs
  const pendingRuns = getPendingRuns();
  const toSpawn = pendingRuns.slice(0, availableSlots);

  for (const run of toSpawn) {
    const job = getJob(run.job_id);
    if (!job) {
      console.log(`  Run ${run.id} has no job, skipping`);
      continue;
    }

    try {
      const windowName = await spawnJob(job, run);
      updateRunStarted(run.id, windowName);
      console.log(
        `  Spawned run ${run.id} for job ${job.id} in window ${windowName}`,
      );
    } catch (e) {
      console.error(`  Failed to spawn run ${run.id}: ${(e as Error).message}`);
    }
  }
}
