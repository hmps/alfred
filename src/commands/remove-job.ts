import * as readline from 'node:readline';
import { deleteJob, getJob } from '../db/jobs';

export async function removeJobCommand(jobId: string): Promise<void> {
  const job = getJob(jobId);

  if (!job) {
    console.error(`Error: Job '${jobId}' not found.`);
    process.exit(1);
  }

  // Ask for confirmation
  const confirmed = await confirm(
    `Are you sure you want to delete job '${jobId}' and all its runs? (y/N) `,
  );

  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  deleteJob(jobId);
  console.log(`Deleted job '${jobId}' and all its runs.`);
}

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
