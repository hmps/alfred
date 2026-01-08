# Alfred - Agent Instructions

Alfred is a CLI tool for scheduling and running jobs via tmux, built with Bun and TypeScript.

## Quick Reference

```bash
bun test                    # Run all tests
bun test tests/cron.test.ts # Run single test file
bun test -t "pattern"       # Run tests matching name pattern
bun run lint                # Lint + autofix with Biome
bun run typecheck           # Type check with tsc
```

## Project Structure

```
src/
├── cli.ts              # CLI entry point (commander)
├── config.ts           # YAML config loading
├── paths.ts            # Path constants (~/.alfred/)
├── commands/           # CLI command implementations
├── db/                 # SQLite database layer (bun:sqlite)
│   ├── client.ts       # DB connection
│   ├── schema.ts       # SQL schema
│   ├── jobs.ts         # Job CRUD
│   └── runs.ts         # Run CRUD
├── scheduler/          # Scheduling logic
│   ├── cron.ts         # Cron parsing utilities
│   └── tick.ts         # Main scheduler loop
└── runner/             # Job execution via tmux
tests/                  # Test files (*.test.ts)
```

## Bun Runtime

**Use Bun APIs, not Node equivalents:**

| Use This | Not This |
|----------|----------|
| `bun test` | jest, vitest |
| `bun:sqlite` | better-sqlite3 |
| `Bun.file()` | fs.readFile/writeFile |
| `Bun.spawn()` | child_process, execa |
| `Bun.serve()` | express |
| `Bun.$\`cmd\`` | execa |

Bun auto-loads `.env` - don't use dotenv.

## Code Style (Biome)

Config: `biome.json`

- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Imports**: Auto-organized by Biome
- **Lint rules**: Biome recommended set

Run `bun run lint` to auto-fix issues.

## TypeScript Conventions

Config: `tsconfig.json`

**Strict mode enabled with:**
- `noUncheckedIndexedAccess: true` - Array access returns `T | undefined`
- `noImplicitOverride: true` - Explicit `override` keyword required
- `verbatimModuleSyntax: true` - Explicit `type` keyword for type imports

**Import order:**
```typescript
// 1. Node built-ins (always use node: prefix)
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// 2. Bun built-ins
import { Database } from 'bun:sqlite';

// 3. Third-party
import { program } from 'commander';

// 4. Local imports (relative paths)
import { initDb } from './db/client';
import type { Job } from '../db/jobs';  // explicit type import
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `add-job.ts`, `list-jobs.ts` |
| Test files | `*.test.ts` in `tests/` | `cron.test.ts` |
| Functions | camelCase | `createJob`, `getNextCronTime` |
| Command handlers | `${name}Command` | `initCommand`, `addJobCommand` |
| Boolean predicates | `is*`, `has*` | `isValidCron`, `jobExists` |
| Types/Interfaces | PascalCase | `Job`, `RunStatus` |
| Input types | `*Input` | `CreateJobInput` |
| Constants | SCREAMING_SNAKE | `ALFRED_DIR`, `ALFRED_DB_PATH` |
| DB columns | snake_case | `job_id`, `next_run_at` |

## Error Handling

**CLI commands (user-facing):**
```typescript
if (!existsSync(ALFRED_DB_PATH)) {
  console.error('Error: Alfred is not initialized. Run "alfred init" first.');
  process.exit(1);
}
```

**Library/utility functions:**
```typescript
if (Number.isNaN(date.getTime())) {
  throw new Error(`Invalid datetime format: ${input}`);
}
```

**Catching in CLI:**
```typescript
try {
  const atDate = parseAtTime(at);
} catch (e) {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
}
```

## Testing Patterns

**Framework:** `bun:test`

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

describe('Feature', () => {
  test('behavior description', () => {
    expect(actual).toBe(expected);
  });
});
```

**Temp database pattern:**
```typescript
function createTestDb(): { db: Database; cleanup: () => void } {
  const tempDir = mkdtempSync(join(tmpdir(), 'alfred-test-'));
  const dbPath = join(tempDir, 'test.db');
  const db = new Database(dbPath);
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

test('example', () => {
  const { db, cleanup } = createTestDb();
  try {
    // test code
  } finally {
    cleanup();
  }
});
```

## Database (bun:sqlite)

```typescript
import { Database } from 'bun:sqlite';

const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL');

// Prepared statements
const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
const job = stmt.get(id) as Job | undefined;  // type assertion required

// All rows
const jobs = stmt.all() as Job[];
```

## Bun Patterns

**File I/O:**
```typescript
const file = Bun.file(path);
if (await file.exists()) {
  const content = await file.text();
}
await Bun.write(path, content);
```

**Process spawning:**
```typescript
const proc = Bun.spawn(['tmux', 'has-session', '-t', session], {
  stdout: 'pipe',
  stderr: 'pipe',
});
const exitCode = await proc.exited;
const output = await new Response(proc.stdout).text();
```

## Key Dependencies

- `commander` - CLI framework
- `cron-parser` - Cron expression parsing
- `yaml` - Config file parsing

## Anti-Patterns

- **No barrel files** - Import directly from modules
- **No premature abstraction** - Wait for third use
- **No callback style** - Use async/await throughout
- **No dotenv** - Bun loads .env automatically
