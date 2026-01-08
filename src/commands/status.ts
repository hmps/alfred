import { isDaemonRunning } from '../daemon/process';
import { getAllJobs, getJob } from '../db/jobs';
import { countRunsByStatus, getPendingRuns, getRunningRuns } from '../db/runs';
import { ALFRED_PID_PATH } from '../paths';

export async function statusCommand(): Promise<void> {
  // Daemon status
  const { running: daemonRunning, pid: daemonPid } = isDaemonRunning();
  const daemonStatus = daemonRunning
    ? `running (pid: ${daemonPid})`
    : 'stopped';
  console.log(`Daemon:    ${daemonStatus}`);

  const jobs = getAllJobs();
  const runCounts = countRunsByStatus();

  // Count job types
  let scheduledCount = 0;
  let oneOffCount = 0;
  for (const job of jobs) {
    if (job.schedule_cron) {
      scheduledCount++;
    } else {
      oneOffCount++;
    }
  }

  // Print summary
  console.log(
    `Jobs:      ${jobs.length} total, ${scheduledCount} scheduled, ${oneOffCount} one-off`,
  );
  console.log(
    `Runs:      ${runCounts.running} running, ${runCounts.pending} pending, ${runCounts.completed} completed, ${runCounts.failed} failed`,
  );
  console.log();

  // Print running jobs
  const runningRuns = getRunningRuns();
  if (runningRuns.length > 0) {
    console.log('Running:');
    for (const run of runningRuns) {
      const job = getJob(run.job_id);
      const jobName = job?.name ?? run.job_id;
      const startedAt = run.started_at ? new Date(run.started_at) : null;
      const ago = startedAt ? formatTimeAgo(startedAt) : 'unknown';
      console.log(`  ${jobName} (run ${run.id}) - started ${ago}`);
    }
    console.log();
  }

  // Print pending jobs
  const pendingRuns = getPendingRuns();
  if (pendingRuns.length > 0) {
    console.log('Pending:');
    for (const run of pendingRuns) {
      const job = getJob(run.job_id);
      const jobName = job?.name ?? run.job_id;
      console.log(`  ${jobName} (run ${run.id}) - queued`);
    }
    console.log();
  }

  if (runningRuns.length === 0 && pendingRuns.length === 0) {
    console.log('No active runs.');
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  if (diffMins > 0) {
    return `${diffMins}m ago`;
  }
  return `${diffSecs}s ago`;
}
