// Group ordering — the same rules as the NianPlay app (PlaylistDetailPage.buildGroupedQueue):
//  - play mode: groups in playlist order, each in its own order (group_position), then the
//    tracks that belong to no group;
//  - shuffle: only the ORDER OF THE GROUPS is shuffled (each group keeps its internal order),
//    and the loose tracks are shuffled and spread between the groups.
// Queue items carry `group: { key, position } | null`.

function shuffleArray(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Split into group segments (first-appearance order, each sorted by position) + loose tracks
function splitGroups(items, groupOrder = null) {
  const segs = new Map()
  const loose = []
  for (const it of items) {
    if (!it.group) { loose.push(it); continue }
    if (!segs.has(it.group.key)) segs.set(it.group.key, [])
    segs.get(it.group.key).push(it)
  }
  let keys = [...segs.keys()]
  if (groupOrder) {
    const rank = new Map(groupOrder.map((k, i) => [k, i]))
    keys = keys.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9))
  }
  const segments = keys.map(k => segs.get(k).slice().sort((a, b) => (a.group.position ?? 0) - (b.group.position ?? 0)))
  return { segments, loose }
}

// Play order: groups (in groupOrder) then loose tracks
function groupedOrder(items, groupOrder = null) {
  const { segments, loose } = splitGroups(items, groupOrder)
  return [...segments.flat(), ...loose]
}

// Group-aware shuffle (identical distribution to the app)
function groupedShuffle(items, rng = Math.random) {
  const { segments: segs, loose } = splitGroups(items)
  const segments = shuffleArray(segs, rng)
  const pool = shuffleArray(loose, rng)
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

const hasGroups = items => items.some(it => it.group)

module.exports = { shuffleArray, splitGroups, groupedOrder, groupedShuffle, hasGroups }
