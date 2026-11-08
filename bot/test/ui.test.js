const test = require('node:test')
const assert = require('node:assert')
const ui = require('../src/ui/embeds')

// Discord rejects a message whose action row has more than 5 components ("Must be between 1 and 5 in length")
test('player controls respect Discord limits (1-5 buttons per row, max 5 rows)', () => {
  for (const loop of ['off', 'track', 'queue']) {
    for (const isPaused of [false, true]) {
      const rows = ui.controls({ index: 1, isPaused, loop })
      assert.ok(rows.length >= 1 && rows.length <= 5)
      for (const row of rows) assert.ok(row.components.length >= 1 && row.components.length <= 5)
      const ids = rows.flatMap(r => r.components.map(c => c.custom_id))
      assert.deepStrictEqual(ids.sort(), ['np:loop', 'np:previous', 'np:shuffle', 'np:skip', 'np:stop', 'np:toggle'])
    }
  }
})

test('queue pager respects Discord limits', () => {
  const row = ui.queuePager(2, 3)
  const comps = row.components || row.toJSON().components
  assert.ok(comps.length >= 1 && comps.length <= 5)
})
