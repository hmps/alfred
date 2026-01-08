import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { getJob } from '../db/jobs';
import type { Run } from '../db/runs';
import { getLatestRun, getRun } from '../db/runs';
import { getLogPath } from '../paths';

export async function logCommand(jobId: string, runId?: string): Promise<void> {
  // Verify job exists
  const job = getJob(jobId);
  if (!job) {
    console.error(`Error: Job '${jobId}' not found.`);
    process.exit(1);
  }

  // Get the run
  let run: Run | undefined;
  if (runId) {
    run = getRun(runId);
    if (!run || run.job_id !== jobId) {
      console.error(`Error: Run '${runId}' not found for job '${jobId}'.`);
      process.exit(1);
    }
  } else {
    run = getLatestRun(jobId);
    if (!run) {
      console.error(`Error: No runs found for job '${jobId}'.`);
      process.exit(1);
    }
  }

  // Get log path
  const logPath = getLogPath(jobId, run.id);

  if (!existsSync(logPath)) {
    console.error(`Error: Log file not found at ${logPath}`);
    console.error(
      'The run may not have started yet or logs were not captured.',
    );
    process.exit(1);
  }

  // If run is still active, use tail -f; otherwise, just cat
  const isActive = run.status === 'pending' || run.status === 'running';

  if (isActive) {
    console.log(`Streaming log for run ${run.id} (press Ctrl+C to stop)...\n`);
    const tail = spawn('tail', ['-f', logPath], {
      stdio: 'inherit',
    });

    // Handle interrupts
    process.on('SIGINT', () => {
      tail.kill();
      process.exit(0);
    });

    await new Promise((resolve) => {
      tail.on('close', resolve);
    });
  } else {
    // Just output the file
    const content = await Bun.file(logPath).text();
    console.log(content);
  }
}
