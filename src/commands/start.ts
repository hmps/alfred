import { isDaemonRunning, spawnDaemon } from '../daemon/process';

/**
 * Start the alfred daemon in the background
 */
export async function startCommand(): Promise<void> {
  const { running, pid } = isDaemonRunning();

  if (running) {
    console.log(`Alfred daemon is already running (pid: ${pid})`);
    process.exit(1);
  }

  console.log('Starting alfred daemon...');

  const daemonPid = await spawnDaemon();

  console.log(`Alfred daemon started (pid: ${daemonPid})`);
  console.log('Run "alfred status" to check daemon status');
  console.log('Run "alfred stop" to stop the daemon');
}
