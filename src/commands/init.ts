import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { getDefaultConfigYaml } from '../config';
import { initDb } from '../db/client';
import {
  ALFRED_CONFIG_DIR,
  ALFRED_CONFIG_PATH,
  ALFRED_DIR,
  ALFRED_LOGS_DIR,
} from '../paths';

export async function initCommand(): Promise<void> {
  console.log('Initializing Alfred...\n');

  // Create directories
  await mkdir(ALFRED_DIR, { recursive: true });
  console.log(`Created ${ALFRED_DIR}`);

  await mkdir(ALFRED_LOGS_DIR, { recursive: true });
  console.log(`Created ${ALFRED_LOGS_DIR}`);

  await mkdir(ALFRED_CONFIG_DIR, { recursive: true });
  console.log(`Created ${ALFRED_CONFIG_DIR}`);

  // Initialize database
  initDb();
  console.log('Initialized database');

  // Create default config if missing
  if (!existsSync(ALFRED_CONFIG_PATH)) {
    await Bun.write(ALFRED_CONFIG_PATH, getDefaultConfigYaml());
    console.log(`Created default config at ${ALFRED_CONFIG_PATH}`);
  } else {
    console.log(`Config already exists at ${ALFRED_CONFIG_PATH}`);
  }

  console.log('\nAlfred initialized successfully!');
  console.log("Run 'alfred add-job' to add a job.");
  console.log("Run 'alfred start' to start the daemon.");
}
