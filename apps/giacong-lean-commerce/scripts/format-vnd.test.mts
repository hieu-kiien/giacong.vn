import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatVnd } from '../src/lib/format-vnd.ts';

test('VND output matches Vietnamese currency formatting across business amounts', () => {
  const reference = new Intl.NumberFormat('vi-VN', { currency: 'VND', maximumFractionDigits: 0, style: 'currency' });
  const amounts = [0, -0, 1, -1, 999, 1000, 123456789, Number.MAX_SAFE_INTEGER, 0.49, 0.5, -0.49, -0.5, 999.5, NaN, Infinity, -Infinity, 1e21];
  for (let i = 0; i < 1000; i++) amounts.push(i * 982451653, -i * 982451653);
  for (const amount of amounts) assert.equal(formatVnd(amount), reference.format(amount), String(amount));
});

test('ordinary VND amounts require no ICU formatter initialization', async () => {
  const original = Intl.NumberFormat;
  try {
    Intl.NumberFormat = class { constructor() { throw new Error('unexpected ICU initialization'); } } as unknown as typeof Intl.NumberFormat;
    const modulePath = '../src/lib/format-vnd.ts?no-icu';
    const fresh = await import(modulePath);
    assert.equal(fresh.formatVnd(1234567), '1.234.567\u00a0₫');
  } finally { Intl.NumberFormat = original; }
});
