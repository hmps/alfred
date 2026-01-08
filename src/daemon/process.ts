import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { ALFRED_DAEMON_LOG, ALFRED_PID_PATH } from '../paths';

/**
 * Check if the daemon is currently running
 */
export function isDaemonRunning(): { running: boolean; pid?: number } {
  if (!existsSync(ALFRED_PID_PATH)) {
    return { running: false };
  }

  const pidStr = readFileSync(ALFRED_PID_PATH, 'utf-8').trim();
  const pid = Number.parseInt(pidStr, 10);

  if (Number.isNaN(pid)) {
    return { running: false };
  }

  // Check if process is alive
  try {
    process.kill(pid, 0); // Signal 0 just checks if process exists
    return { running: true, pid };
  } catch {
    // Process doesn't exist, clean up stale PID file
    unlinkSync(ALFRED_PID_PATH);
    return { running: false };
  }
}

/**
 * Write the current process PID to the PID file
 */
export function writePidFile(): void {
  Bun.write(ALFRED_PID_PATH, String(process.pid));
}

/**
 * Remove the PID file
 */
export function removePidFile(): void {
  if (existsSync(ALFRED_PID_PATH)) {
    unlinkSync(ALFRED_PID_PATH);
  }
}

/**
 * Get the path to the alfred binary for spawning
 */
export async function getAlfredBinaryPath(): Promise<string> {
  const argvPath = process.argv[1];

  // In compiled Bun binaries, argv[1] is a virtual path like /$bunfs/root/alfred
  if (argvPath?.startsWith('/$bunfs')) {
    const proc = Bun.spawn(['which', 'alfred'], { stdout: 'pipe' });
    const path = (await new Response(proc.stdout).text()).trim();
    await proc.exited;
    if (path) return path;
  }

  return argvPath ?? 'alfred';
}

/**
 * Spawn the daemon as a detached background process
 */
export async function spawnDaemon(): Promise<number> {
  const alfredPath = await getAlfredBinaryPath();

  // Spawn via shell to handle log redirection properly
  const proc = Bun.spawn(['sh', '-c', `"${alfredPath}" _daemon >> "${ALFRED_DAEMON_LOG}" 2>&1`], {
    detached: true,
    stdout: 'ignore',
    stderr: 'ignore',
    stdin: 'ignore',
  });

  // Unref so parent can exit
  proc.unref();

  // Give the child a moment to start and write its PID
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Read the PID that the child wrote
  if (existsSync(ALFRED_PID_PATH)) {
    const pidStr = readFileSync(ALFRED_PID_PATH, 'utf-8').trim();
    return Number.parseInt(pidStr, 10);
  }

  return proc.pid;
}

/**
 * Stop the daemon by sending SIGTERM
 */
export async function stopDaemon(): Promise<boolean> {
  const { running, pid } = isDaemonRunning();

  if (!running || !pid) {
    return false;
  }

  try {
    process.kill(pid, 'SIGTERM');

    // Wait for process to exit (up to 5 seconds)
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const { running: stillRunning } = isDaemonRunning();
      if (!stillRunning) {
        return true;
      }
    }

    // Force kill if still running
    process.kill(pid, 'SIGKILL');
    removePidFile();
    return true;
  } catch {
    removePidFile();
    return false;
  }
}
