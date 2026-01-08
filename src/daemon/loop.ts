import { loadConfig } from '../config';
import { tick } from '../scheduler/tick';
import { daemonLog, rotateLogIfNeeded } from './log';
import { removePidFile, writePidFile } from './process';

let isRunning = true;

/**
 * Handle shutdown signals gracefully
 */
function setupSignalHandlers(): void {
  const shutdown = () => {
    daemonLog('Received shutdown signal, stopping...');
    isRunning = false;
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Sleep for the specified number of seconds
 */
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Main daemon loop
 * Runs tick at configured intervals until stopped
 */
export async function runDaemonLoop(): Promise<void> {
  // Write PID file
  writePidFile();
  daemonLog(`Daemon started (pid: ${process.pid})`);

  // Setup signal handlers
  setupSignalHandlers();

  // Load initial config
  const config = await loadConfig();
  let tickInterval = config.tick_interval;

  daemonLog(`Tick interval: ${tickInterval}s`);

  while (isRunning) {
    try {
      // Rotate logs if needed
      rotateLogIfNeeded();

      // Run tick
      await tick();
    } catch (e) {
      daemonLog(`Tick error: ${(e as Error).message}`);
    }

    // Reload config to pick up changes
    try {
      const newConfig = await loadConfig();
      if (newConfig.tick_interval !== tickInterval) {
        tickInterval = newConfig.tick_interval;
        daemonLog(`Tick interval changed to ${tickInterval}s`);
      }
    } catch {
      // Ignore config reload errors
    }

    // Sleep until next tick (check isRunning periodically for faster shutdown)
    const sleepEnd = Date.now() + tickInterval * 1000;
    while (isRunning && Date.now() < sleepEnd) {
      await sleep(1);
    }
  }

  // Cleanup
  removePidFile();
  daemonLog('Daemon stopped');
}
