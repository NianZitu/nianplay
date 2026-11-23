const test = require('node:test')
const assert = require('node:assert')
const { parseTime } = require('../src/ui/format')

test('parseTime accepts seconds, clock format and h/m/s units', () => {
  const ok = {
    '90': 90, '0': 0, '1:30': 90, '01:02:03': 3723, '3m15s': 195, '3m 15s': 195, '3M15S': 195,
    '1h2m3s': 3723, '45s': 45, '2m': 120, '2min': 120, '1h': 3600, '1h30': 5400, '1h30s': 3630, '3m15': 195,
  }
  for (const [text, secs] of Object.entries(ok)) assert.strictEqual(parseTime(text), secs, text)
  for (const bad of ['', 'abc', '1:2:3:4', 'm', 'h', '3x', '-5', '1:75s']) assert.strictEqual(parseTime(bad), null, bad)
})
