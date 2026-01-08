import { isDaemonRunning, stopDaemon } from '../daemon/process';

/**
 * Stop the alfred daemon
 */
export async function stopCommand(): Promise<void> {
  const { running, pid } = isDaemonRunning();

  if (!running) {
    console.log('Alfred daemon is not running');
    process.exit(1);
  }

  console.log(`Stopping alfred daemon (pid: ${pid})...`);

  const stopped = await stopDaemon();

  if (stopped) {
    console.log('Alfred daemon stopped');
  } else {
    console.error('Failed to stop daemon');
    process.exit(1);
  }
}
