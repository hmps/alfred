import { describe, expect, test } from 'bun:test';
import {
  formatDatetime,
  getNextCronTime,
  isValidCron,
  parseDatetime,
} from '../src/scheduler/cron';

describe('Cron utilities', () => {
  describe('getNextCronTime', () => {
    test('calculates next minute for * * * * *', () => {
      const from = new Date('2024-06-15T10:30:00');
      const next = getNextCronTime('* * * * *', from);

      expect(next.getMinutes()).toBe(31);
    });

    test('calculates next hour for 0 * * * *', () => {
      const from = new Date('2024-06-15T10:30:00');
      const next = getNextCronTime('0 * * * *', from);

      expect(next.getHours()).toBe(11);
      expect(next.getMinutes()).toBe(0);
    });

    test('calculates next occurrence for 0 3 * * *', () => {
      const from = new Date('2024-06-15T10:30:00');
      const next = getNextCronTime('0 3 * * *', from);

      // Should be 3am tomorrow since it's already past 3am
      expect(next.getDate()).toBe(16);
      expect(next.getHours()).toBe(3);
      expect(next.getMinutes()).toBe(0);
    });

    test('handles every 2 hours: 0 */2 * * *', () => {
      const from = new Date('2024-06-15T09:30:00');
      const next = getNextCronTime('0 */2 * * *', from);

      expect(next.getHours()).toBe(10);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('isValidCron', () => {
    test('returns true for valid expressions', () => {
      expect(isValidCron('* * * * *')).toBe(true);
      expect(isValidCron('0 * * * *')).toBe(true);
      expect(isValidCron('0 3 * * *')).toBe(true);
      expect(isValidCron('0 */2 * * *')).toBe(true);
      expect(isValidCron('30 4 1 * *')).toBe(true);
    });

    test('returns false for invalid expressions', () => {
      expect(isValidCron('invalid')).toBe(false);
      expect(isValidCron('60 * * * *')).toBe(false); // Invalid minute
    });
  });

  describe('formatDatetime', () => {
    test('formats date as YYYY-MM-DD HH:mm:ss', () => {
      const date = new Date('2024-06-15T10:30:45.123Z');
      const formatted = formatDatetime(date);

      expect(formatted).toBe('2024-06-15 10:30:45');
    });
  });

  describe('parseDatetime', () => {
    test('parses YYYY-MM-DD HH:mm:ss format', () => {
      const parsed = parseDatetime('2024-06-15 10:30:45');

      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(5); // June
      expect(parsed.getDate()).toBe(15);
      expect(parsed.getHours()).toBe(10);
      expect(parsed.getMinutes()).toBe(30);
    });
  });
});
