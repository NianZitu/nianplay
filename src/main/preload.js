const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Window controls
  window: {
    minimize:    () => ipcRenderer.invoke('window:minimize'),
    maximize:    () => ipcRenderer.invoke('window:maximize'),
    close:       () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // Library
  library: {
    scan:        (folderPath) => ipcRenderer.invoke('library:scan', folderPath),
    getTracks:   ()           => ipcRenderer.invoke('library:getTracks'),
    updateTrack: (track)      => ipcRenderer.invoke('library:updateTrack', track),
    getTrack:    (id)         => ipcRenderer.invoke('library:getTrack', id),
    removeTrack: (id)         => ipcRenderer.invoke('library:removeTrack', id),
    clearAll:    ()           => ipcRenderer.invoke('library:clearAll'),
    chooseFolder: ()          => ipcRenderer.invoke('library:chooseFolder'),
    exportAll:          ()      => ipcRenderer.invoke('library:exportAll'),
    importAll:          ()      => ipcRenderer.invoke('library:importAll'),
    importVirtualTrack: (track) => ipcRenderer.invoke('library:importVirtualTrack', track),
  },

  // Downloads
  downloader: {
    start:          (opts) => ipcRenderer.invoke('downloader:start', opts),
    startForTrack:  (opts) => ipcRenderer.invoke('downloader:startForTrack', opts),
    cancel:         (id)   => ipcRenderer.invoke('downloader:cancel', id),
    getQueue:       ()     => ipcRenderer.invoke('downloader:getQueue'),
    ytdlpStatus:    ()     => ipcRenderer.invoke('downloader:ytdlpStatus'),
    onProgress:  (cb)   => {
      const handler = (_, data) => cb(data)
      ipcRenderer.on('downloader:progress', handler)
      return () => ipcRenderer.removeListener('downloader:progress', handler)
    },
  },

  // Playlists
  playlists: {
    getAll:             ()                            => ipcRenderer.invoke('playlists:getAll'),
    create:             (opts)                        => ipcRenderer.invoke('playlists:create', opts),
    update:             (opts)                        => ipcRenderer.invoke('playlists:update', opts),
    delete:             (id)                          => ipcRenderer.invoke('playlists:delete', id),
    getTracks:          (playlistId)                  => ipcRenderer.invoke('playlists:getTracks', playlistId),
    addTrack:           (playlistId, trackId)         => ipcRenderer.invoke('playlists:addTrack', { playlistId, trackId }),
    removeTrack:        (playlistId, trackId)         => ipcRenderer.invoke('playlists:removeTrack', { playlistId, trackId }),
    reorder:            (playlistId, orderedTrackIds) => ipcRenderer.invoke('playlists:reorder', { playlistId, orderedTrackIds }),
    chooseCover:        ()                            => ipcRenderer.invoke('playlists:chooseCover'),
    searchImageBrowser: (query)                       => ipcRenderer.invoke('playlists:searchImageBrowser', query),
    export:             (id)                          => ipcRenderer.invoke('playlists:export', id),
    import:             ()                            => ipcRenderer.invoke('playlists:import'),
  },

  // Spotify
  spotify: {
    resolve: (url) => ipcRenderer.invoke('spotify:resolve', url),
  },

  // YouTube Search
  ytSearch: {
    search: (query) => ipcRenderer.invoke('ytSearch:search', query),
  },

  // LUFS / Equalization
  lufs: {
    measure:          (filePath)                         => ipcRenderer.invoke('lufs:measure', filePath),
    equalizePlaylist: (anchorTrackId, playlistId)        => ipcRenderer.invoke('lufs:equalizePlaylist', { anchorTrackId, playlistId }),
    onProgress:       (cb) => {
      const handler = (_, data) => cb(data)
      ipcRenderer.on('lufs:progress', handler)
      return () => ipcRenderer.removeListener('lufs:progress', handler)
    },
  },

  // Lyrics
  lyrics: {
    fetch: (opts) => ipcRenderer.invoke('lyrics:fetch', opts),
  },

  // Settings
  settings: {
    get:    (key)        => ipcRenderer.invoke('settings:get', key),
    set:    (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: ()           => ipcRenderer.invoke('settings:getAll'),
  },

  // Dialog
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  },

  // Auto-updater
  updater: {
    check:        ()    => ipcRenderer.invoke('update:check'),
    openDownload: (url) => ipcRenderer.send('update:openDownload', url),
    onAvailable:  (cb)  => {
      const handler = (_, info) => cb(info)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
  },
})
