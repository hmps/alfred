---

# Alfred: Personal AI Job Scheduler

Build a CLI tool called **Alfred** - a job scheduler that runs commands on schedules. It can run any command: AI prompts, ralph loops, scripts, anything.

## Tech Stack

- **Bun** runtime
- **Commander** for CLI
- **better-sqlite3** for persistence
- **yaml** for config parsing
- **cron-parser** for cron expressions
- **Bun's built-in test runner** for tests

## Directory Structure

```
src/
├── cli.ts                 # Entry point, commander setup
├── commands/
│   ├── init.ts
│   ├── add-job.ts
│   ├── list-jobs.ts
│   ├── remove-job.ts
│   ├── status.ts
│   ├── tick.ts
│   └── log.ts
├── db/
│   ├── client.ts          # SQLite connection
│   ├── schema.ts          # Table definitions
│   ├── jobs.ts            # Job CRUD
│   └── runs.ts            # Run instance CRUD
├── scheduler/
│   ├── tick.ts            # Main tick logic
│   └── cron.ts            # Cron parsing helpers
├── runner/
│   ├── spawn.ts           # Spawn job in tmux
│   └── tmux.ts            # Tmux session/window helpers
├── config.ts              # Load ~/.config/alfred/config.yaml
└── paths.ts               # Central path definitions
tests/
├── db.test.ts
├── scheduler.test.ts
├── cron.test.ts
├── time-parsing.test.ts
└── commands/
    └── ...
```

## Paths

- **Database**: `~/.alfred/alfred.db`
- **Logs**: `~/.alfred/logs/<job_id>-<run_id>.log`
- **Config**: `~/.config/alfred/config.yaml`

## Database Schema

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  command TEXT NOT NULL,              -- The command to run
  schedule_cron TEXT,                 -- NULL for one-off jobs
  paused INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  next_run_at TEXT                    -- NULL if not scheduled or paused
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',      -- pending, running, completed, failed
  started_at TEXT,
  completed_at TEXT,
  exit_code INTEGER,
  tmux_window TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX idx_jobs_next_run ON jobs(next_run_at) WHERE next_run_at IS NOT NULL AND paused = 0;
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_job_id ON runs(job_id);
```

## Config File

```yaml
# ~/.config/alfred/config.yaml
max_parallel: 3
tmux_session: alfred
```

## Commands

### `alfred init`

1. Create `~/.alfred/` and `~/.alfred/logs/` directories
2. Initialize SQLite database with schema
3. Create default config at `~/.config/alfred/config.yaml` if missing
4. Add to user's crontab: `* * * * * <path-to-alfred> tick >> ~/.alfred/tick.log 2>&1`
5. Print success message

### `alfred add-job <name> --command <cmd> [options]`

Options:
- `--command <cmd>` - Command to run (required)
- `--dir <path>` - Working directory (default: current dir)
- `--cron <expr>` - Cron schedule for recurring jobs
- `--at <datetime>` - Run once at specific time
- `--run-now` - Queue immediately

**`--at` format:**
- ISO datetime: `2025-01-08T00:00:00`
- 24-hour time: `HH:MM` (e.g., `01:20` for 20 past 1am, `23:30` for 11:30pm)
  - If the time has already passed today, schedule for tomorrow
  - Examples: `00:00` (midnight), `14:30` (2:30pm), `09:00` (9am)

**Scheduling rules:**
- `--run-now`: Create a run in `pending` status immediately
- `--at`: Set `next_run_at` to the specified time, no cron (one-off)
- `--cron`: Calculate `next_run_at` from cron expression, recurring
- None of the above: Error - must specify when to run

Examples:
```bash
# Run now
alfred add-job refactor-auth \
  --command "ralph .ai-jobs/refactor-auth.md" \
  --run-now

# Run at midnight tonight (or tomorrow if past midnight)
alfred add-job big-migration \
  --dir ~/projects/vaam \
  --command "ralph .ai-jobs/migrate-db.md" \
  --at 00:00

# Run at 2:30am
alfred add-job deploy \
  --command "./scripts/deploy.sh" \
  --at 02:30

# Run at specific datetime
alfred add-job one-time-task \
  --command "echo 'hello'" \
  --at "2025-01-08T14:00:00"

# Recurring every 2 hours
alfred add-job check-inbox \
  --command "claude -p 'Check inbox'" \
  --cron "0 */2 * * *"

# Recurring every minute (for testing)
alfred add-job debug-test \
  --command "echo 'Alfred tick at $(date)'" \
  --cron "* * * * *"
```

### `alfred list-jobs`

List all jobs:
```
ID              NAME              SCHEDULE       NEXT RUN            PAUSED
refactor-auth   refactor-auth     (one-off)      -                   no
check-inbox     check-inbox       0 */2 * * *    2025-01-08 14:00    no
backup-db       backup-db         0 3 * * *      2025-01-09 03:00    no
big-migration   big-migration     (at 00:00)     2025-01-09 00:00    no
```

### `alfred remove-job <job_id>`

Delete job and all its runs (cascades via foreign key). Ask for confirmation before deleting.

### `alfred status`

Show current state:
```
Jobs:      5 total, 2 scheduled, 3 one-off
Runs:      2 running, 1 pending, 45 completed, 3 failed

Running:
  check-inbox (run abc123) - started 2m ago
  refactor-auth (run xyz789) - started 15m ago

Pending:
  backup-db (run def456) - queued
```

### `alfred tick`

Called by cron every minute:

1. **Check scheduled jobs**: Find jobs where `next_run_at <= now` and `paused = 0`
   - Create a new run in `pending` status
   - For cron jobs: Calculate and update `next_run_at` for next occurrence
   - For one-off jobs (`--at` or `--run-now`): Set `next_run_at = NULL` after queuing
   
2. **Check running jobs**: For each run with `status = 'running'`
   - Check if tmux window still exists
   - If window gone, read exit code file:
     - Exit 0 → status = 'completed'
     - Exit non-zero → status = 'failed'
   - Update `completed_at` and `exit_code`
   
3. **Spawn pending jobs**: Up to `max_parallel` concurrent
   - Count current running jobs
   - For each pending run (up to available slots):
     - Spawn in tmux window
     - Update status to 'running', set `started_at`

### `alfred log <job_id> [run_id]`

- If `run_id` provided, show that run's log
- Otherwise, show most recent run's log
- Stream the log (like `tail -f`) if run is still active

## Job Execution

When spawning a run:

1. Ensure tmux session exists (create if not: `tmux new-session -d -s alfred`)
2. Create new window: `tmux new-window -t alfred -n <job_id_short>`
3. Execute command in window, logging output and capturing exit code:
   ```bash
   tmux send-keys -t alfred:<window> \
     "cd <working_dir> && <command> 2>&1 | tee <log_file>; echo $? > <exit_code_file>; exit" Enter
   ```
4. Store the window name in the run record
5. Log file: `~/.alfred/logs/<job_id>-<run_id>.log`
6. Exit code file: `~/.alfred/logs/<job_id>-<run_id>.exit`

To check if a run is still going:
- Check if tmux window exists: `tmux list-windows -t alfred -F "#{window_name}"`

To get exit code when window is gone:
- Read from `<exit_code_file>`

## Time Parsing

Create a utility function to parse the `--at` option:

```typescript
function parseAtTime(input: string): Date {
  // Try ISO format first
  if (input.includes('T') || input.includes('-')) {
    return new Date(input);
  }
  
  // Parse HH:MM format
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid time format: ${input}`);
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (hours < 0 || hours > 23) throw new Error(`Invalid hour: ${hours}`);
  if (minutes < 0 || minutes > 59) throw new Error(`Invalid minute: ${minutes}`);
  
  const now = new Date();
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  
  // If time has passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  return target;
}
```

Write comprehensive tests for this function:
- `00:00` → midnight tonight or tomorrow
- `23:59` → 11:59pm tonight or tomorrow
- `14:30` → 2:30pm
- `9:00` and `09:00` both work
- `2025-01-08T14:00:00` → exact datetime
- Invalid inputs throw errors: `25:00`, `12:60`, `abc`, `12:345`

## Tests

Write tests using Bun's test runner (`bun test`).

Test:
- Time parsing (`parseAtTime` function) - all formats and edge cases
- Database operations (jobs CRUD, runs CRUD)
- Cron parsing and next-run calculation
- Tick logic (scheduling, cleanup, spawning - mock tmux calls)
- Command argument parsing

Use a temp database file for tests, clean up after.

## Implementation Order

1. Set up project structure, paths, config loading
2. Database schema and client
3. Jobs and runs CRUD operations
4. Time parsing utility with tests
5. `init` command
6. `add-job` command
7. `list-jobs` command
8. `remove-job` command
9. Cron parsing utilities
10. Tmux helpers (create session, create window, check window exists)
11. `tick` command - scheduling logic (queue due jobs)
12. `tick` command - cleanup logic (check finished runs)
13. `tick` command - spawn logic (run pending jobs)
14. `status` command
15. `log` command
16. Tests for all components

## Success Criteria

The implementation is complete when:

1. All commands work as specified
2. `alfred init` sets up cron to call alfred tick every minute automatically
3. `--at` accepts both ISO datetime and HH:MM format
4. `bun test` passes with tests for all components
5. **End-to-end verification**: The following works:
   ```bash
   alfred init
   alfred add-job debug-ping \
     --command "echo 'Alfred executed at $(date)' >> ~/.alfred/debug.log" \
     --cron "* * * * *"
   alfred list-jobs  # Shows debug-ping with next run time
   # Wait for tick to run (or run `alfred tick` manually)
   alfred status     # Shows the run
   cat ~/.alfred/debug.log  # Shows timestamped output
   ```
   
   The debug job should execute every minute, appending to the log file each time.

Build and test iteratively until all features are complete and the end-to-end test passes.

---
