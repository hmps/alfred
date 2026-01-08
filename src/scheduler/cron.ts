import { CronExpressionParser } from 'cron-parser';

export function parseAtTime(input: string): Date {
  if (input.includes('T') || input.includes('-')) {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid datetime format: ${input}`);
    }
    return date;
  }

  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(
      `Invalid time format: ${input}. Expected HH:MM or ISO datetime.`,
    );
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid hour: ${hours}. Must be 0-23.`);
  }
  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minute: ${minutes}. Must be 0-59.`);
  }

  const now = new Date();
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

export function getNextCronTime(
  cronExpr: string,
  from: Date = new Date(),
): Date {
  const expr = CronExpressionParser.parse(cronExpr, { currentDate: from });
  return expr.next().toDate();
}

export function isValidCron(cronExpr: string): boolean {
  try {
    CronExpressionParser.parse(cronExpr);
    return true;
  } catch {
    return false;
  }
}

export function formatDatetime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function parseDatetime(str: string): Date {
  return new Date(str.replace(' ', 'T'));
}
