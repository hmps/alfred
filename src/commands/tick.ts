import { tick } from '../scheduler/tick';

export async function tickCommand(): Promise<void> {
  await tick();
}
