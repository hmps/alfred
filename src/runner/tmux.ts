import { loadConfig } from '../config';

export async function ensureTmuxSession(): Promise<string> {
  const config = await loadConfig();
  const session = config.tmux_session;

  // Check if session exists
  const hasSession = await tmuxSessionExists(session);

  if (!hasSession) {
    // Create new detached session
    const proc = Bun.spawn(['tmux', 'new-session', '-d', '-s', session], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
  }

  return session;
}

export async function tmuxSessionExists(session: string): Promise<boolean> {
  const proc = Bun.spawn(['tmux', 'has-session', '-t', session], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

export async function createTmuxWindow(
  session: string,
  windowName: string,
): Promise<string> {
  // Use session: syntax to create window at next available index
  const proc = Bun.spawn(
    [
      'tmux',
      'new-window',
      '-t',
      `${session}:`,
      '-n',
      windowName,
      '-P',
      '-F',
      '#{window_id}',
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output.trim();
}

export async function sendTmuxKeys(
  session: string,
  window: string,
  command: string,
): Promise<void> {
  const proc = Bun.spawn(
    ['tmux', 'send-keys', '-t', `${session}:${window}`, command, 'Enter'],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  await proc.exited;
}

export async function listTmuxWindows(session: string): Promise<string[]> {
  const proc = Bun.spawn(
    ['tmux', 'list-windows', '-t', session, '-F', '#{window_name}'],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return [];
  }

  return output.trim().split('\n').filter(Boolean);
}

export async function tmuxWindowExists(
  session: string,
  windowName: string,
): Promise<boolean> {
  const windows = await listTmuxWindows(session);
  return windows.includes(windowName);
}
