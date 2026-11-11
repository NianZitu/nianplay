// Play order for a playlist with "grupos de sequência" — same as buildGroupedQueue in
// src/renderer/pages/PlaylistDetailPage.jsx: grouped tracks play together in their group order;
// shuffling shuffles whole groups and spreads the ungrouped tracks between them.

export function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildGroupedQueue(tracks, groups, shuffleGroups = false) {
  const grouped = {}
  groups.forEach(g => { grouped[g.id] = [] })
  tracks.forEach(t => { if (t.group_id && grouped[t.group_id]) grouped[t.group_id].push(t) })
  Object.values(grouped).forEach(arr => arr.sort((a, b) => (a.group_position ?? 0) - (b.group_position ?? 0)))

  let segments = groups.filter(g => grouped[g.id]?.length > 0).map(g => grouped[g.id])
  const ungrouped = tracks.filter(t => !t.group_id || !grouped[t.group_id])

  if (shuffleGroups) {
    segments = shuffleArray(segments)
    const pool = shuffleArray(ungrouped)
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
