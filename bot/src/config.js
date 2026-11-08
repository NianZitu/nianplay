// Settings come from environment variables (file .env next to package.json — see .env.example).
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true })

const env = (name, fallback = '') => (process.env[name] ?? fallback).toString().trim()
const num = (name, fallback) => {
  const v = Number(env(name, ''))
  return Number.isFinite(v) && env(name, '') !== '' ? v : fallback
}

module.exports = {
  // Discord
  token:     env('DISCORD_TOKEN'),
  clientId:  env('DISCORD_CLIENT_ID'),
  devGuildId: env('DISCORD_GUILD_ID'),          // optional: register commands instantly in one server

  // Tools (on the VPS both come from install.sh; locally they must be on PATH or set here)
  ytdlpPath:  env('YTDLP_PATH', 'yt-dlp'),
  ffmpegPath: env('FFMPEG_PATH', 'ffmpeg'),
  // YouTube often blocks datacenter IPs ("Sign in to confirm you're not a bot").
  // A cookies.txt exported from a YouTube account usually fixes it (see README).
  ytdlpCookies: env('YTDLP_COOKIES'),
  // yt-dlp needs a JavaScript runtime to solve YouTube's challenges (without it the audio formats disappear,
  // "Requested format is not available"). Default: the same Node.js that runs the bot. "none" disables it.
  ytdlpJsRuntime: env('YTDLP_JS_RUNTIME') || `node:${process.execPath}`,
  ytdlpExtraArgs: env('YTDLP_EXTRA_ARGS').split(/\s+/).filter(Boolean),

  // Spotify (optional): without them, playlists/albums are read from the public embed
  // (up to 100 tracks). With a free app from developer.spotify.com there is no limit.
  spotifyClientId:     env('SPOTIFY_CLIENT_ID'),
  spotifyClientSecret: env('SPOTIFY_CLIENT_SECRET'),

  // NianPlay cloud (public Firestore data of the "Comunidade" — no secret needed)
  firebaseProjectId: env('NIANPLAY_FIREBASE_PROJECT', 'nianplay-bdd59'),
  firebaseApiKey:    env('NIANPLAY_FIREBASE_API_KEY', 'AIzaSyBF7kTz5bBZ6VG7uODbbWfZKh_ZM9T7mgk'),

  // Behaviour
  defaultVolume: num('DEFAULT_VOLUME', 70),          // %
  maxQueue:      num('MAX_QUEUE', 1000),
  idleLeaveSeconds:  num('IDLE_LEAVE_SECONDS', 180),  // leave after the queue ends
  aloneLeaveSeconds: num('ALONE_LEAVE_SECONDS', 120), // leave when nobody else is in the channel
  applyNianplayGain: env('APPLY_NIANPLAY_GAIN', 'true') !== 'false', // LUFS gain saved in NianPlay
  applyNianplayCuts: env('APPLY_NIANPLAY_CUTS', 'true') !== 'false', // cut segments saved in NianPlay
}
