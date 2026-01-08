import { getAllJobs } from '../db/jobs';
import { getLatestRun } from '../db/runs';

export async function listJobsCommand(): Promise<void> {
  const jobs = getAllJobs();

  if (jobs.length === 0) {
    console.log("No jobs found. Use 'alfred add-job' to create one.");
    return;
  }

  // Print header
  const header = [
    padRight('ID', 20),
    padRight('NAME', 20),
    padRight('SCHEDULE', 15),
    padRight('LAST RUN', 25),
    padRight('NEXT RUN', 20),
    padRight('PAUSED', 6),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  // Print jobs
  for (const job of jobs) {
    let schedule: string;
    if (job.schedule_cron) {
      schedule = job.schedule_cron;
    } else if (job.next_run_at) {
      schedule = '(one-off)';
    } else {
      schedule = '(one-off)';
    }

    const nextRun = job.next_run_at ?? '-';
    const paused = job.paused ? 'yes' : 'no';

    // Get last run info
    const lastRun = getLatestRun(job.id);
    let lastRunStr = '-';
    if (lastRun) {
      if (lastRun.status === 'running') {
        lastRunStr = 'running';
      } else if (lastRun.status === 'pending') {
        lastRunStr = 'pending';
      } else if (lastRun.completed_at) {
        const status = lastRun.status === 'completed' ? 'ok' : 'fail';
        lastRunStr = `${lastRun.completed_at} (${status})`;
      }
    }

    const row = [
      padRight(job.id, 20),
      padRight(job.name, 20),
      padRight(schedule, 15),
      padRight(lastRunStr, 25),
      padRight(nextRun, 20),
      padRight(paused, 6),
    ].join('  ');

    console.log(row);
  }
}

function padRight(str: string, len: number): string {
  if (str.length >= len) {
    return str.slice(0, len);
  }
  return str + ' '.repeat(len - str.length);
}
