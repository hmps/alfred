# Alfred

A personal AI job scheduler CLI that runs commands on schedules. It can run any command: AI prompts, scripts, anything.

## Installation

```bash
bun install
bun run build
bun run install  # copies binary to ~/.local/bin/alfred
```

## Quick Start

```bash
# Initialize Alfred
alfred init

# Start the daemon
alfred start

# Add a job that runs immediately
alfred add-job my-task --command "echo hello" --run-now

# Check status
alfred status
```

## Usage

### Daemon Control

Alfred uses a background daemon instead of cron:

```bash
alfred start     # Start the daemon (or `alfred daemon`)
alfred stop      # Stop the daemon
alfred status    # Shows daemon state, jobs, and runs
```

### Adding Jobs

```bash
# Run immediately
alfred add-job my-task --command "echo 'hello'" --run-now

# Run at specific time (HH:MM format, schedules for today or tomorrow)
alfred add-job deploy --command "./deploy.sh" --at 14:30

# Run at specific datetime (ISO format)
alfred add-job backup --command "pg_dump > backup.sql" --at "2025-01-15T03:00:00"

# Recurring job with cron expression
alfred add-job check-inbox --command "claude -p 'Check inbox'" --cron "0 */2 * * *"

# Specify working directory
alfred add-job build --command "bun run build" --dir ~/projects/myapp --cron "0 3 * * *"
```

### Creating Jobs with Complex Commands

For commands with complex quoting, pipes, or multiple steps, create a shell script:

```bash
# Create a scripts directory
mkdir -p ~/.alfred/scripts

# Create your script
cat > ~/.alfred/scripts/my-job.sh << 'EOF'
#!/bin/bash
RESULT=$(claude -p "summarize my inbox" 2>&1)
terminal-notifier -title "Alfred" -message "$RESULT"
EOF

chmod +x ~/.alfred/scripts/my-job.sh

# Add the job
alfred add-job inbox-summary --command ~/.alfred/scripts/my-job.sh --cron "0 9 * * *"
```

This avoids escaping issues when passing commands through multiple shell layers.

### List Jobs

```bash
alfred ls
```

### Check Status

```bash
alfred status
```

Shows daemon state, running jobs, pending jobs, and summary counts.

### View Logs

```bash
# View most recent run's log
alfred log my-task

# View specific run's log
alfred log my-task abc123
```

### Remove a Job

```bash
alfred rm my-task
```

## Configuration

Edit `~/.config/alfred/config.yaml`:

```yaml
max_parallel: 3       # Maximum concurrent jobs
tmux_session: alfred  # Tmux session name for job windows
tick_interval: 60     # Seconds between scheduling checks
```

## How It Works

1. Jobs are stored in SQLite with their schedule (cron or one-off time)
2. The daemon runs a tick loop every `tick_interval` seconds which:
   - Checks for due jobs and queues them as pending runs
   - Spawns pending jobs in tmux windows (up to `max_parallel`)
3. Jobs run in tmux windows under the `alfred` session
4. When a job completes, it calls `alfred complete` to immediately update its status
5. Job output is logged to `~/.alfred/logs/<job_id>-<run_id>.log`
6. Exit codes are captured in `~/.alfred/logs/<job_id>-<run_id>.exit`

### Viewing Running Jobs

Jobs run in tmux windows. To attach and see what's happening:

```bash
tmux attach -t alfred
```

Use `Ctrl-b w` to list windows, `Ctrl-b n/p` to navigate.

## Development

### Building

```bash
bun run build    # Compile standalone binary to dist/alfred
bun run install  # Build and copy to ~/.local/bin/alfred
```

### Project Structure

```
src/
├── cli.ts              # Entry point, commander setup
├── config.ts           # Load config from YAML
├── paths.ts            # Central path definitions
├── commands/           # CLI command implementations
│   ├── init.ts
│   ├── start.ts
│   ├── stop.ts
│   ├── add-job.ts
│   ├── list-jobs.ts
│   ├── remove-job.ts
│   ├── status.ts
│   ├── complete.ts
│   ├── tick.ts
│   └── log.ts
├── daemon/             # Background daemon
│   ├── loop.ts
│   ├── process.ts
│   └── log.ts
├── db/                 # Database layer (bun:sqlite)
│   ├── client.ts
│   ├── schema.ts
│   ├── jobs.ts
│   └── runs.ts
├── scheduler/          # Scheduling logic
│   ├── tick.ts
│   └── cron.ts
└── runner/             # Job execution
    ├── spawn.ts
    └── tmux.ts
```

### Running Tests

```bash
bun test
```

### Linting

```bash
bun run lint
```

### Type Checking

```bash
bun run typecheck
```

## Database Schema

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  command TEXT NOT NULL,
  schedule_cron TEXT,          -- NULL for one-off jobs
  paused INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  next_run_at TEXT             -- NULL if not scheduled or paused
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, running, completed, failed
  started_at TEXT,
  completed_at TEXT,
  exit_code INTEGER,
  tmux_window TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
```

## License

MIT
