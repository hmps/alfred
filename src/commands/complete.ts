import { updateRunCompleted } from '../db/runs';

/**
 * Mark a run as completed (called by job wrapper)
 * This is an internal command used by the job spawn wrapper
 */
export async function completeCommand(
  runId: string,
  exitCode: number,
): Promise<void> {
  updateRunCompleted(runId, exitCode);
}
