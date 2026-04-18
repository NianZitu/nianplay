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

  // Keep refs in sync every render
  queueRef.current         = queue
  currentIdxRef.current    = currentIdx
  shuffleRef.current       = shuffle
  volumeRef.current        = volume
  shuffledOrderRef.current = shuffledOrder
  shuffledPosRef.current   = shuffledPos
  groupsEnabledRef.current = groupsEnabled

  const currentTrack = queue[currentIdx] ?? null

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

    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('timeupdate', () => {
        const dur = audioRef.current.duration || 1
        setProgress(audioRef.current.currentTime / dur)
        setDuration(dur)
      })
      audioRef.current.addEventListener('ended', () => { _advanceNext() })
    }

    const { gain } = ensureAudioContext()
    gainNodeRef.current = gain
    if (!audioRef.current._connected) {
      const source = contextRef.current.createMediaElementSource(audioRef.current)
      source.connect(gain)
      audioRef.current._connected = true
    }

    setCurrentIdx(safeIdx)
    currentIdxRef.current = safeIdx

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

  const skipPrev = useCallback(() => {
    const q   = queueRef.current
    if (q.length === 0) return
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }
    if (shuffleRef.current) {
      const pos = shuffledPosRef.current
      if (pos <= 0) { audioRef.current && (audioRef.current.currentTime = 0); return }
      const prevPos = pos - 1
      shuffledPosRef.current = prevPos
      setShuffledPos(prevPos)
      _playByIdx(shuffledOrderRef.current[prevPos])
    } else {
      _playByIdx((currentIdxRef.current - 1 + q.length) % q.length)
    }
  }, [])

  const seek = useCallback((ratio) => {
    if (audioRef.current) audioRef.current.currentTime = ratio * (audioRef.current.duration || 0)
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

  // Upcoming queue: tracks that will play next (in shuffled or normal order)
  const upcomingTracks = (() => {
    if (queue.length === 0) return []
    if (shuffle && shuffledOrder.length > 0) {
      return shuffledOrder.slice(shuffledPos + 1).map(i => queue[i]).filter(Boolean)
    }
    if (currentIdx < 0) return []
    const after = []
    for (let i = 1; i < queue.length; i++) {
      after.push(queue[(currentIdx + i) % queue.length])
    }
    return after
  })()

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
      playTrack, playNext, togglePlay, skipNext, skipPrev, seek, setVolume,
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
