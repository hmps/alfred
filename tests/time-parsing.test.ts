import { describe, expect, test } from 'bun:test';
import { parseAtTime } from '../src/scheduler/cron';

describe('parseAtTime', () => {
  describe('HH:MM format', () => {
    test('parses 00:00 as midnight', () => {
      const result = parseAtTime('00:00');
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    test('parses 23:59 as 11:59pm', () => {
      const result = parseAtTime('23:59');
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });

    test('parses 14:30 as 2:30pm', () => {
      const result = parseAtTime('14:30');
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    test('parses single digit hour (9:00)', () => {
      const result = parseAtTime('9:00');
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
    });

    test('parses zero-padded hour (09:00)', () => {
      const result = parseAtTime('09:00');
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
    });

    test('if time has passed today, schedules for tomorrow', () => {
      const now = new Date();
      const pastHour = now.getHours() - 1;
      if (pastHour >= 0) {
        const pastTime = `${pastHour.toString().padStart(2, '0')}:00`;
        const result = parseAtTime(pastTime);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(result.getDate()).toBe(tomorrow.getDate());
      }
    });

    test('if time is in future today, schedules for today', () => {
      const now = new Date();
      const futureHour = now.getHours() + 1;
      if (futureHour <= 23) {
        const futureTime = `${futureHour.toString().padStart(2, '0')}:00`;
        const result = parseAtTime(futureTime);
        expect(result.getDate()).toBe(now.getDate());
      }
    });
  });

  describe('ISO datetime format', () => {
    test('parses full ISO datetime', () => {
      const result = parseAtTime('2025-01-08T14:00:00');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getDate()).toBe(8);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
    });

    test('parses date with dashes', () => {
      const result = parseAtTime('2025-06-15T09:30:00');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(5); // June is 5
      expect(result.getDate()).toBe(15);
    });
  });

  describe('invalid inputs', () => {
    test('throws on invalid hour (25:00)', () => {
      expect(() => parseAtTime('25:00')).toThrow('Invalid hour: 25');
    });

    test('throws on invalid minute (12:60)', () => {
      expect(() => parseAtTime('12:60')).toThrow('Invalid minute: 60');
    });

    test('throws on non-time string', () => {
      expect(() => parseAtTime('abc')).toThrow('Invalid time format');
    });

    test('throws on malformed time (12:345)', () => {
      expect(() => parseAtTime('12:345')).toThrow('Invalid time format');
    });

    test('throws on empty string', () => {
      expect(() => parseAtTime('')).toThrow('Invalid time format');
    });

    test('throws on invalid ISO date', () => {
      expect(() => parseAtTime('2025-99-99T00:00:00')).toThrow(
        'Invalid datetime format',
      );
    });
  });
});
