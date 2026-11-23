const test = require('node:test')
const assert = require('node:assert')
const { parseSpotify, isSpotifyLink } = require('../src/sources/spotify')
const { musicScore } = require('../src/sources/resolve')

test('Spotify links: full, intl, embed, ?si=, URI and phone short links', () => {
  const id = '4cOdK2wGLETKBW3PvgPWqT'
  for (const u of [
    `https://open.spotify.com/track/${id}`,
    `https://open.spotify.com/intl-pt/track/${id}?si=abc123`,
    `https://open.spotify.com/embed/track/${id}`,
    `spotify:track:${id}`,
  ]) assert.deepStrictEqual(parseSpotify(u), { type: 'track', id }, u)
  assert.deepStrictEqual(parseSpotify('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x'), { type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' })
  assert.ok(isSpotifyLink('https://spotify.link/AbCdEf123'))
  assert.ok(isSpotifyLink('https://spotify.app.link/AbCdEf123'))
  assert.ok(!isSpotifyLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
  assert.ok(!isSpotifyLink('never gonna give you up'))
})

test('YouTube Music ranking prefers the same version (not remix/live/cover)', () => {
  const item = { title: 'Never Gonna Give You Up', artist: 'Rick Astley' }
  const results = [
    { title: 'Never Gonna Give You Up (Funny Indian Remix)' },
    { title: 'Never Gonna Give You Up (En Directo / Live 2022)' },
    { title: 'Never Gonna Give You Up' },
  ]
  const best = results.map(r => ({ r, s: musicScore(r, item) })).sort((a, b) => b.s - a.s)[0].r
  assert.strictEqual(best.title, 'Never Gonna Give You Up')
  assert.ok(musicScore({ title: 'Never Gonna Give You Up (Remix)' }, { title: 'Never Gonna Give You Up (Remix)' }) >= 0.85, 'a remix is fine when the remix was asked for')
  assert.ok(musicScore({ title: 'Flower In A Hurricane' }, { title: 'Flower In A Hurricane (feat. SZA) [From GTAVI: Original Score]' }) >= 0.85, 'feat./from ignored')
})
