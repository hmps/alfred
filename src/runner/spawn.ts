import type { Job } from '../db/jobs';
import type { Run } from '../db/runs';
import { getAlfredBinaryPath } from '../daemon/process';
import { getExitCodePath, getLogPath } from '../paths';
import { createTmuxWindow, ensureTmuxSession, sendTmuxKeys } from './tmux';

export async function spawnJob(job: Job, run: Run): Promise<string> {
  // Ensure tmux session exists
  const session = await ensureTmuxSession();

  // Create a short window name
  const windowName = `${job.id}-${run.id}`.slice(0, 20);

  // Create new window
  await createTmuxWindow(session, windowName);

  // Build the command with logging, exit code capture, and completion callback
  const logPath = getLogPath(job.id, run.id);
  const exitCodePath = getExitCodePath(job.id, run.id);
  const alfredPath = await getAlfredBinaryPath();

  // The command:
  // 1. cd to working directory
  // 2. Run the command, piping output to log file
  // 3. Capture exit code using PIPESTATUS[0] (bash) or pipestatus[1] (zsh)
  // 4. Write exit code to file (for fallback detection)
  // 5. Call alfred complete to immediately mark run as done
  // 6. Exit the window
  // Use bash explicitly since PIPESTATUS is bash-specific
  const bashScript = `
cd "${job.working_dir}" && \\
${job.command} 2>&1 | tee "${logPath}"; \\
EXITCODE=\${PIPESTATUS[0]}; \\
echo \$EXITCODE > "${exitCodePath}"; \\
"${alfredPath}" complete "${run.id}" \$EXITCODE
`.trim();

  const fullCommand = `bash -c '${bashScript.replace(/'/g, "'\\''")}'; exit`;

  // Send the command to the window
  await sendTmuxKeys(session, windowName, fullCommand);

  return windowName;
}
