const test = require('node:test')
const assert = require('node:assert')
const { groupedOrder, groupedShuffle, shuffleArray } = require('../src/queue/grouping')

// Copy of the NianPlay app's algorithm (src/renderer/pages/PlaylistDetailPage.jsx, buildGroupedQueue)
// used as the reference: same input + same random numbers must give the same queue.
function appBuildGroupedQueue(tracks, groups, shuffleGroups, rng) {
  const shuffle = arr => shuffleArray(arr, rng)
  const grouped = {}
  groups.forEach(g => { grouped[g.id] = [] })
  tracks.forEach(t => { if (t.group_id && grouped[t.group_id]) grouped[t.group_id].push(t) })
  Object.values(grouped).forEach(arr => arr.sort((a, b) => (a.group_position ?? 0) - (b.group_position ?? 0)))
  let segments = groups.filter(g => grouped[g.id]?.length > 0).map(g => grouped[g.id])
  const ungrouped = tracks.filter(t => !t.group_id)
  if (shuffleGroups) {
    segments = shuffle(segments)
    const pool = shuffle(ungrouped)
    const result = []
    segments.forEach((seg, i) => {
      result.push(...seg)
      if (i < segments.length - 1) {
        const slots = segments.length - 1
        const start = Math.round((i / slots) * pool.length)
        const end = Math.round(((i + 1) / slots) * pool.length)
        result.push(...pool.slice(start, end))
      }
    })
    const placed = Math.round(((segments.length - 1) / Math.max(segments.length - 1, 1)) * pool.length)
    result.push(...pool.slice(placed))
    return result
  }
  const result = []
  segments.forEach(seg => result.push(...seg))
  result.push(...ungrouped)
  return result
}

function seeded(seed) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 }

function randomPlaylist(rng) {
  const groups = Array.from({ length: Math.floor(rng() * 5) }, (_, i) => ({ id: `g${i}` }))
  const n = 1 + Math.floor(rng() * 30)
  const posByGroup = {}
  const tracks = Array.from({ length: n }, (_, i) => {
    const g = groups.length && rng() < 0.6 ? groups[Math.floor(rng() * groups.length)].id : null
    const pos = g ? (posByGroup[g] = (posByGroup[g] ?? -1) + 1) : 0
    return { id: `t${i}`, group_id: g, group_position: g ? pos : 0 }
  })
  // shuffle group positions so input order != group order
  return { groups, tracks: shuffleArray(tracks, rng) }
}

const toItems = (tracks, groups) => tracks.map(t => ({ id: t.id, group: t.group_id ? { key: t.group_id, position: t.group_position } : null }))

test('play order matches the app (300 random playlists)', () => {
  const rng = seeded(7)
  for (let i = 0; i < 300; i++) {
    const { groups, tracks } = randomPlaylist(rng)
    const expected = appBuildGroupedQueue(tracks, groups, false).map(t => t.id)
    const got = groupedOrder(toItems(tracks, groups), groups.map(g => g.id)).map(t => t.id)
    assert.deepStrictEqual(got, expected)
  }
})

test('group shuffle matches the app with the same random numbers (300 random playlists)', () => {
  const rng = seeded(11)
  for (let i = 0; i < 300; i++) {
    const { groups, tracks } = randomPlaylist(rng)
    // The bot finds segments by first appearance; give both the same segment order before shuffling
    const firstSeen = []
    for (const t of tracks) if (t.group_id && !firstSeen.includes(t.group_id)) firstSeen.push(t.group_id)
    const orderedGroups = firstSeen.map(id => ({ id }))
    const seed = Math.floor(rng() * 1e9)
    const expected = appBuildGroupedQueue(tracks, orderedGroups, true, seeded(seed)).map(t => t.id)
    const got = groupedShuffle(toItems(tracks, groups), seeded(seed)).map(t => t.id)
    assert.deepStrictEqual(got, expected)
  }
})

test('group shuffle keeps every group contiguous and in its internal order', () => {
  const rng = seeded(3)
  for (let i = 0; i < 200; i++) {
    const { groups, tracks } = randomPlaylist(rng)
    const out = groupedShuffle(toItems(tracks, groups), rng)
    assert.strictEqual(out.length, tracks.length)
    for (const g of groups) {
      const idx = out.map((t, k) => (t.group?.key === g.id ? k : -1)).filter(k => k >= 0)
      if (!idx.length) continue
      assert.strictEqual(idx[idx.length - 1] - idx[0] + 1, idx.length, 'group is contiguous')
      const positions = idx.map(k => out[k].group.position)
      assert.deepStrictEqual(positions, [...positions].sort((a, b) => a - b), 'internal order kept')
    }
  }
})
