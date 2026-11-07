const test = require('node:test')
const assert = require('node:assert')
const { GuildPlayer } = require('../src/player/GuildPlayer')

// Player without Discord: playback is stubbed, only the queue logic is exercised
function makePlayer() {
  const p = new GuildPlayer({ name: 'test', id: '1' }, { onEvent: () => {} })
  p.playIndex = async function (i) { this.index = i; this._fakeActive = true }
  // A started track counts as active (real playback is stubbed out)
  Object.defineProperty(p, 'isActive', { get() { return Boolean(this._fakeActive) } })
  return p
}
const item = (id, group = null, position = 0) => ({ id, title: id, url: `https://www.youtube.com/watch?v=${id.padEnd(11, 'x')}`, group: group ? { key: group, name: group, position } : null })
const ids = arr => arr.map(it => it.id)

test('enqueue starts the first item and "next" inserts after the current one', async () => {
  const p = makePlayer()
  await p.enqueue([item('a'), item('b'), item('c')])
  assert.strictEqual(p.current.id, 'a')
  await p.enqueue([item('n')], { next: true })
  assert.deepStrictEqual(ids(p.upcoming), ['n', 'b', 'c'])
})

test('adding while a track is active does not skip it; adding after the queue ended starts the new one', async () => {
  const p = makePlayer()
  await p.enqueue([item('a')])
  await p.enqueue([item('b')])
  assert.strictEqual(p.current.id, 'a', 'current track kept')
  p._fakeActive = false; p.index = p.queue.length   // queue ended
  await p.enqueue([item('c')])
  assert.strictEqual(p.current.id, 'c')
})

test('remove / move / skipTo use 1-based positions of the upcoming list', async () => {
  const p = makePlayer()
  await p.enqueue(['a', 'b', 'c', 'd', 'e'].map(x => item(x)))
  assert.strictEqual(p.remove(2).id, 'c')
  assert.deepStrictEqual(ids(p.upcoming), ['b', 'd', 'e'])
  assert.strictEqual(p.move(3, 1).id, 'e')
  assert.deepStrictEqual(ids(p.upcoming), ['e', 'b', 'd'])
  assert.strictEqual(p.remove(9), null)
  await p.skipTo(2)
  assert.strictEqual(p.current.id, 'b')
  assert.deepStrictEqual(ids(p.upcoming), ['d'])
  assert.strictEqual(p.clearUpcoming(), 1)
  assert.deepStrictEqual(ids(p.upcoming), [])
})

test('shuffle without groups keeps the current track and all items', async () => {
  const p = makePlayer()
  await p.enqueue(Array.from({ length: 20 }, (_, i) => item(`t${i}`)))
  const before = ids(p.upcoming).sort()
  const res = p.shuffle()
  assert.strictEqual(res.mode, 'normal')
  assert.strictEqual(p.current.id, 't0')
  assert.deepStrictEqual(ids(p.upcoming).sort(), before)
})

test('group shuffle: rest of the current group stays next, other groups stay whole', async () => {
  for (let run = 0; run < 50; run++) {
    const p = makePlayer()
    const queue = [
      item('a1', 'A', 0), item('a2', 'A', 1), item('a3', 'A', 2),
      item('b1', 'B', 0), item('b2', 'B', 1),
      item('c1', 'C', 0), item('c2', 'C', 1), item('c3', 'C', 2),
      item('x'), item('y'), item('z'),
    ]
    await p.enqueue(queue)            // playing a1
    const res = p.shuffle()
    assert.strictEqual(res.mode, 'groups')
    const up = ids(p.upcoming)
    assert.deepStrictEqual(up.slice(0, 2), ['a2', 'a3'], 'current group continues')
    assert.strictEqual(up.length, 10)
    for (const g of [['b1', 'b2'], ['c1', 'c2', 'c3']]) {
      const at = up.indexOf(g[0])
      assert.deepStrictEqual(up.slice(at, at + g.length), g, `group ${g[0][0]} intact and in order`)
    }
  }
})
