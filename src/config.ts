import { parse } from 'yaml';
import { ALFRED_CONFIG_PATH } from './paths';

export interface AlfredConfig {
  max_parallel: number;
  tmux_session: string;
  tick_interval: number;
}

const DEFAULT_CONFIG: AlfredConfig = {
  max_parallel: 3,
  tmux_session: 'alfred',
  tick_interval: 60,
};

export async function loadConfig(): Promise<AlfredConfig> {
  const file = Bun.file(ALFRED_CONFIG_PATH);
  if (!(await file.exists())) {
    return DEFAULT_CONFIG;
  }
  const content = await file.text();
  const parsed = parse(content) as Partial<AlfredConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
  };
}

export function getDefaultConfigYaml(): string {
  return `max_parallel: 3
tmux_session: alfred
tick_interval: 60
`;
}
