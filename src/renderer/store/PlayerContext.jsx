import React, { createContext, useContext, useRef, useState, useCallback } from 'react'

const PlayerContext = createContext(null)

function fisherYates(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function normalizedCuts(track, duration = 0) {
  const max = Number(duration) || Number(track?.duration) || 0
  const cuts = (Array.isArray(track?.cut_segments) ? track.cut_segments : [])
    .map(seg => ({
      start: Math.max(0, Number(seg.start) || 0),
      end: Math.max(0, Number(seg.end) || 0),
    }))
    .map(seg => max ? { start: Math.min(seg.start, max), end: Math.min(seg.end, max) } : seg)
    .filter(seg => seg.end > seg.start)
    .sort((a, b) => a.start - b.start)

  const merged = []
  for (const cut of cuts) {
    const prev = merged[merged.length - 1]
    if (prev && cut.start <= prev.end) prev.end = Math.max(prev.end, cut.end)
    else merged.push({ ...cut })
  }
  return merged
}

function playableDuration(track, audioDuration = 0) {
  const dur = Number(audioDuration) || Number(track?.duration) || 0
  if (!dur) return 0
  const removed = normalizedCuts(track, dur).reduce((sum, cut) => sum + (cut.end - cut.start), 0)
  return Math.max(0, dur - removed)
}

function audioToPlayableTime(audioTime, track, audioDuration = 0) {
  const time = Math.max(0, Number(audioTime) || 0)
  let removedBefore = 0
  for (const cut of normalizedCuts(track, audioDuration)) {
    if (time >= cut.end) {
      removedBefore += cut.end - cut.start
    } else if (time > cut.start) {
      return Math.max(0, cut.start - removedBefore)
    } else {
      break
    }
  }
  return Math.max(0, time - removedBefore)
}

function playableToAudioTime(playableTime, track, audioDuration = 0) {
  const target = Math.max(0, Number(playableTime) || 0)
  let cursor = 0
  let remaining = target
  for (const cut of normalizedCuts(track, audioDuration)) {
    const availableBeforeCut = Math.max(0, cut.start - cursor)
    if (remaining <= availableBeforeCut) return cursor + remaining
    remaining -= availableBeforeCut
    cursor = cut.end
  }
  const dur = Number(audioDuration) || Number(track?.duration) || 0
  const audioTime = cursor + remaining
  return dur ? Math.min(audioTime, dur) : audioTime
}

export function PlayerProvider({ children }) {
  const audioRef    = useRef(null)
  const gainRef     = useRef(null)
  const contextRef  = useRef(null)
  const gainNodeRef = useRef(null)

  // Refs that mirror state — keep fresh for the `ended` listener (created once)
  const queueRef         = useRef([])
  const currentIdxRef    = useRef(-1)
  const shuffleRef       = useRef(false)
  const volumeRef        = useRef(0.8)
  const shuffledOrderRef = useRef([])  // indices into queue[], in shuffle order
  const shuffledPosRef   = useRef(0)   // current position inside shuffledOrder
  const groupsEnabledRef = useRef(false)
  const currentTrackRef  = useRef(null)

  const [queue,        setQueue]        = useState([])
  const [currentIdx,   setCurrentIdx]   = useState(-1)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [volume,       setVolumeState]  = useState(0.8)
  const [progress,     setProgress]     = useState(0)
  const [duration,     setDuration]     = useState(0)
  const [anchorTrack,  setAnchorTrack]  = useState(null)
  const [shuffle,      setShuffle]      = useState(false)
  const [shuffledOrder,setShuffledOrder]= useState([])
  const [shuffledPos,  setShuffledPos]  = useState(0)
  const [groupsEnabled,setGroupsEnabledState] = useState(false)
  const restoringRef = useRef(false)
  const persistTimerRef = useRef(null)

  // Keep refs in sync every render
  queueRef.current         = queue
  currentIdxRef.current    = currentIdx
  shuffleRef.current       = shuffle
  volumeRef.current        = volume
  shuffledOrderRef.current = shuffledOrder
  shuffledPosRef.current   = shuffledPos
  groupsEnabledRef.current = groupsEnabled

  const currentTrack = queue[currentIdx] ?? null
  currentTrackRef.current = currentTrack

  function ensureAudioElement() {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('timeupdate', () => {
        skipCutSegmentIfNeeded()
        syncPlaybackClock()
      })
      audioRef.current.addEventListener('loadedmetadata', () => {
        skipCutSegmentIfNeeded()
        syncPlaybackClock()
      })
      audioRef.current.addEventListener('ended', () => { _advanceNext() })
    }
    return audioRef.current
  }

  function skipCutSegmentIfNeeded() {
    const audio = audioRef.current
    const track = currentTrackRef.current
    if (!audio || !track) return
    const now = audio.currentTime || 0
    const cut = normalizedCuts(track, audio.duration).find(seg => now >= seg.start && now < seg.end)
    if (!cut) return
    const dur = audio.duration || track.duration || 0
    audio.currentTime = dur ? Math.min(cut.end + 0.05, dur) : cut.end + 0.05
  }

  function syncPlaybackClock() {
    const audio = audioRef.current
    const track = currentTrackRef.current
    if (!audio || !track) return
    const playableDur = playableDuration(track, audio.duration)
    const playableNow = audioToPlayableTime(audio.currentTime, track, audio.duration)
    setDuration(playableDur || audio.duration || 0)
    setProgress(playableDur ? Math.max(0, Math.min(1, playableNow / playableDur)) : 0)
  }

  function ensureAudioContext() {
    if (!contextRef.current) {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)()
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      contextRef.current  = ctx
      gainRef.current     = gain
      gainNodeRef.current = gain
    }
    return { ctx: contextRef.current, gain: gainRef.current }
  }

  function persistSession() {
    if (!window.electron?.settings?.set || restoringRef.current) return
    const q = queueRef.current || []
    const session = {
      queue: q,
      currentIdx: currentIdxRef.current,
      currentTime: audioRef.current?.currentTime || 0,
      volume: volumeRef.current,
      shuffle: shuffleRef.current,
      shuffledOrder: shuffledOrderRef.current,
      shuffledPos: shuffledPosRef.current,
      groupsEnabled: groupsEnabledRef.current,
    }
    window.electron.settings.set('playerSession', session).catch(() => {})
  }

  // Build a shuffled order starting from the given queue index
  function buildShuffleOrder(startIdx, queueLength) {
    const rest = []
    for (let i = 0; i < queueLength; i++) if (i !== startIdx) rest.push(i)
    const order = [startIdx, ...fisherYates(rest)]
    shuffledOrderRef.current = order
    shuffledPosRef.current   = 0
    setShuffledOrder(order)
    setShuffledPos(0)
    return order
  }

  function _playByIdx(queueIdx) {
    const q = queueRef.current
    if (queueIdx < 0 || queueIdx >= q.length) return
    const track = q[queueIdx]
    if (!audioRef.current) return
    currentIdxRef.current = queueIdx
    setCurrentIdx(queueIdx)
    currentTrackRef.current = track
    audioRef.current.src = `file://${track.file_path}`
    if (gainNodeRef.current) gainNodeRef.current.gain.value = Math.pow(10, (track.gain || 0) / 20)
    audioRef.current.volume = volumeRef.current
    audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error)
  }

  // Advance to next, respecting shuffle order
  function _advanceNext() {
    const q = queueRef.current
    if (q.length === 0) return

    if (shuffleRef.current) {
      const order = shuffledOrderRef.current
      const pos   = shuffledPosRef.current
      const nextPos = pos + 1
      if (nextPos >= order.length) {
        // Re-shuffle when the whole list has played
        const newOrder = buildShuffleOrder(order[pos], q.length)
        _playByIdx(newOrder[1] ?? newOrder[0])
        shuffledPosRef.current = 1
        setShuffledPos(1)
      } else {
        shuffledPosRef.current = nextPos
        setShuffledPos(nextPos)
        _playByIdx(order[nextPos])
      }
    } else {
      _playByIdx((currentIdxRef.current + 1) % q.length)
    }
  }

  const playTrack = useCallback((track, trackQueue = null) => {
    const q = trackQueue || queueRef.current
    if (trackQueue) {
      setQueue(trackQueue)
      queueRef.current = trackQueue
    }
    const idx = q.findIndex(t => t.id === track.id)
    const safeIdx = idx >= 0 ? idx : 0

    ensureAudioElement()

    const { gain } = ensureAudioContext()
    gainNodeRef.current = gain
    if (!audioRef.current._connected) {
      const source = contextRef.current.createMediaElementSource(audioRef.current)
      source.connect(gain)
      audioRef.current._connected = true
    }

    setCurrentIdx(safeIdx)
    currentIdxRef.current = safeIdx
    currentTrackRef.current = track

    // Rebuild shuffle order whenever a new track is chosen manually
    if (shuffleRef.current) {
      buildShuffleOrder(safeIdx, q.length)
    }

    audioRef.current.src = `file://${track.file_path}`
    gain.gain.value = Math.pow(10, (track.gain || 0) / 20)
    audioRef.current.volume = volumeRef.current
    audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error)
  }, [])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().then(() => setIsPlaying(true))
    }
  }, [isPlaying])

  const skipNext = useCallback(() => {
    _advanceNext()
  }, [])

  // Insert track to play immediately after the current track
  const playNext = useCallback((track) => {
    const q = [...queueRef.current]
    const idx = currentIdxRef.current < 0 ? 0 : currentIdxRef.current
    const insertAt = idx + 1
    q.splice(insertAt, 0, track)
    setQueue(q)
    queueRef.current = q

    if (shuffleRef.current) {
      // Shift all indices >= insertAt, then insert at shuffledPos + 1
      const adjusted = shuffledOrderRef.current.map(i => i >= insertAt ? i + 1 : i)
      adjusted.splice(shuffledPosRef.current + 1, 0, insertAt)
      setShuffledOrder(adjusted)
      shuffledOrderRef.current = adjusted
    }
  }, [])

  const playQueueIndex = useCallback((queueIdx) => {
    const q = queueRef.current
    if (queueIdx < 0 || queueIdx >= q.length) return

    if (!audioRef.current) {
      playTrack(q[queueIdx], q)
      return
    }

    if (shuffleRef.current) {
      const pos = shuffledOrderRef.current.findIndex(i => i === queueIdx)
      if (pos >= 0) {
        shuffledPosRef.current = pos
        setShuffledPos(pos)
      } else {
        buildShuffleOrder(queueIdx, q.length)
      }
    }

    _playByIdx(queueIdx)
  }, [playTrack])

  const skipPrev = useCallback(() => {
    const q   = queueRef.current
    if (q.length === 0) return
    if (audioRef.current) {
      const track = currentTrackRef.current
      const playableNow = audioToPlayableTime(audioRef.current.currentTime, track, audioRef.current.duration)
      if (playableNow > 3) {
        audioRef.current.currentTime = playableToAudioTime(0, track, audioRef.current.duration)
        skipCutSegmentIfNeeded()
        syncPlaybackClock()
        return
      }
    }
    if (shuffleRef.current) {
      const pos = shuffledPosRef.current
      if (pos <= 0) {
        if (audioRef.current) {
          const track = currentTrackRef.current
          audioRef.current.currentTime = playableToAudioTime(0, track, audioRef.current.duration)
          skipCutSegmentIfNeeded()
          syncPlaybackClock()
        }
        return
      }
      const prevPos = pos - 1
      shuffledPosRef.current = prevPos
      setShuffledPos(prevPos)
      _playByIdx(shuffledOrderRef.current[prevPos])
      return
    }
    _playByIdx((currentIdxRef.current - 1 + q.length) % q.length)
  }, [])

  const seek = useCallback((ratio) => {
    if (audioRef.current) {
      const track = currentTrackRef.current
      const playableDur = playableDuration(track, audioRef.current.duration)
      audioRef.current.currentTime = playableToAudioTime(ratio * playableDur, track, audioRef.current.duration)
      skipCutSegmentIfNeeded()
      syncPlaybackClock()
    }
  }, [])

  const setVolume = useCallback((v) => {
    setVolumeState(v)
    volumeRef.current = v
    if (audioRef.current) audioRef.current.volume = v
  }, [])

  // Expose a controlled setShuffle that also builds the initial shuffle order
  const handleSetShuffle = useCallback((valOrFn) => {
    const newVal = typeof valOrFn === 'function' ? valOrFn(shuffleRef.current) : valOrFn
    shuffleRef.current = newVal
    setShuffle(newVal)
    if (newVal && queueRef.current.length > 0) {
      buildShuffleOrder(currentIdxRef.current >= 0 ? currentIdxRef.current : 0, queueRef.current.length)
    }
  }, [])

  const setGroupsEnabled = useCallback((val) => {
    groupsEnabledRef.current = val
    setGroupsEnabledState(val)
  }, [])

  React.useEffect(() => {
    let alive = true
    async function restoreSession() {
      if (!window.electron?.settings?.get) return
      restoringRef.current = true
      try {
        const saved = await window.electron.settings.get('playerSession')
        if (!alive || !saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return

        const safeIdx = Math.max(0, Math.min(Number(saved.currentIdx) || 0, saved.queue.length - 1))
        setQueue(saved.queue)
        queueRef.current = saved.queue
        setCurrentIdx(safeIdx)
        currentIdxRef.current = safeIdx
        setVolumeState(typeof saved.volume === 'number' ? saved.volume : 0.8)
        volumeRef.current = typeof saved.volume === 'number' ? saved.volume : 0.8
        setGroupsEnabledState(Boolean(saved.groupsEnabled))
        groupsEnabledRef.current = Boolean(saved.groupsEnabled)
        setShuffle(Boolean(saved.shuffle))
        shuffleRef.current = Boolean(saved.shuffle)
        setShuffledOrder(Array.isArray(saved.shuffledOrder) ? saved.shuffledOrder : [])
        shuffledOrderRef.current = Array.isArray(saved.shuffledOrder) ? saved.shuffledOrder : []
        setShuffledPos(Number(saved.shuffledPos) || 0)
        shuffledPosRef.current = Number(saved.shuffledPos) || 0

        const track = saved.queue[safeIdx]
        currentTrackRef.current = track
        if (track?.file_path) {
          const audio = ensureAudioElement()
          const { gain } = ensureAudioContext()
          gainNodeRef.current = gain
          if (!audio._connected) {
            const source = contextRef.current.createMediaElementSource(audio)
            source.connect(gain)
            audio._connected = true
          }
          audio.src = `file://${track.file_path}`
          gain.gain.value = Math.pow(10, (track.gain || 0) / 20)
          audio.volume = volumeRef.current
          const resumeAt = Math.max(0, Number(saved.currentTime) || 0)
          audio.addEventListener('loadedmetadata', function setResumeTimeOnce() {
            audio.removeEventListener('loadedmetadata', setResumeTimeOnce)
            audio.currentTime = Math.min(resumeAt, audio.duration || resumeAt)
            skipCutSegmentIfNeeded()
            syncPlaybackClock()
          })
        }
      } catch {}
      finally {
        restoringRef.current = false
      }
    }
    restoreSession()
    return () => { alive = false }
  }, [])

  React.useEffect(() => {
    clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => persistSession(), 350)
    return () => clearTimeout(persistTimerRef.current)
  }, [queue, currentIdx, volume, shuffle, shuffledOrder, shuffledPos, groupsEnabled, isPlaying])

  React.useEffect(() => {
    function handleBeforeUnload() {
      persistSession()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  React.useEffect(() => {
    if (!queue.length) return
    const id = setInterval(() => persistSession(), 5000)
    return () => clearInterval(id)
  }, [queue.length])

  const updateQueuedTrack = useCallback((updatedTrack) => {
    if (!updatedTrack?.id) return
    const nextQueue = queueRef.current.map(t => t.id === updatedTrack.id ? { ...t, ...updatedTrack } : t)
    queueRef.current = nextQueue
    setQueue(nextQueue)
    const current = nextQueue[currentIdxRef.current]
    if (current?.id === updatedTrack.id) {
      currentTrackRef.current = current
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = Math.pow(10, (current.gain || 0) / 20)
      }
      skipCutSegmentIfNeeded()
      syncPlaybackClock()
    }
  }, [])

  // Upcoming queue: tracks that will play next (in shuffled or normal order)
  const upcomingItems = (() => {
    if (queue.length === 0) return []
    if (shuffle && shuffledOrder.length > 0) {
      return shuffledOrder.slice(shuffledPos + 1)
        .map(i => ({ track: queue[i], queueIndex: i }))
        .filter(item => item.track)
    }
    if (currentIdx < 0) return []
    const after = []
    for (let i = 1; i < queue.length; i++) {
      const queueIndex = (currentIdx + i) % queue.length
      after.push({ track: queue[queueIndex], queueIndex })
    }
    return after
  })()

  const upcomingTracks = upcomingItems.map(item => item.track)

  return (
    <PlayerContext.Provider value={{
      queue, setQueue,
      currentTrack, currentIdx,
      isPlaying,
      progress, duration,
      volume,
      shuffle, setShuffle: handleSetShuffle,
      shuffledOrder, shuffledPos,
      upcomingTracks,
      anchorTrack, setAnchorTrack,
      groupsEnabled, setGroupsEnabled,
      playTrack, playNext, playQueueIndex, togglePlay, skipNext, skipPrev, seek, setVolume,
      updateQueuedTrack,
      upcomingItems,
      gainNode: gainRef,
      audioContext: contextRef,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}
