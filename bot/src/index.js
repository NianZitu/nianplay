// NianPlay Discord bot — entry point.
const { Client, GatewayIntentBits, Events, MessageFlags, ActivityType } = require('discord.js')
const config = require('./config')
const { GuildPlayer } = require('./player/GuildPlayer')
const { handlers, autocompletePlaylists, UserError, requireSameChannel } = require('./commands')
const ui = require('./ui/embeds')

// Exit code for configuration errors: systemd does not restart in a loop on it (RestartPreventExitStatus)
const CONFIG_ERROR = 78

if (!config.token) {
  console.error('DISCORD_TOKEN não configurado. Copie .env.example para .env e preencha (veja o README).')
  process.exit(CONFIG_ERROR)
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] })

// ── One player per server ─────────────────────────────────────────────────────
const playersByGuild = new Map()
const nowPlayingMessages = new Map()   // guildId → last "Tocando agora" message

async function sendToGuild(player, payload) {
  try { return await player.textChannel?.send(payload) } catch (e) { console.warn('Não consegui enviar mensagem:', e.message) }
}

async function replaceNowPlaying(guildId, msg) {
  const old = nowPlayingMessages.get(guildId)
  nowPlayingMessages.delete(guildId)
  if (old) old.delete().catch(() => {})
  if (msg) nowPlayingMessages.set(guildId, msg)
}

function createPlayer(guild) {
  const player = new GuildPlayer(guild, {
    onEvent: async (type, data) => {
      switch (type) {
        case 'nowPlaying': {
          const msg = await sendToGuild(player, { embeds: [ui.nowPlayingEmbed(player)], components: ui.controls(player) })
          await replaceNowPlaying(guild.id, msg)
          break
        }
        case 'error':
          await sendToGuild(player, { embeds: [ui.error(data.message)] })
          break
        case 'queueEnd':
          await replaceNowPlaying(guild.id, null)
          await sendToGuild(player, { embeds: [ui.info('✅ A fila terminou. Use /play ou /nianplay para tocar mais.')] })
          break
        case 'left':
          await replaceNowPlaying(guild.id, null)
          await sendToGuild(player, { embeds: [ui.info(`👋 ${data.reason}`)] })
          break
        case 'destroyed':
          playersByGuild.delete(guild.id)
          break
      }
    },
  })
  return player
}

const players = {
  get(guild, { create = false } = {}) {
    let p = playersByGuild.get(guild.id)
    if (!p && create) { p = createPlayer(guild); playersByGuild.set(guild.id, p) }
    return p || null
  },
}

// ── Interactions ──────────────────────────────────────────────────────────────
async function replyError(interaction, err) {
  const known = err instanceof UserError
  if (!known) console.error(`[/${interaction.commandName || interaction.customId}]`, err)
  const embed = ui.error(known ? err.message : `Algo deu errado: ${err.message}`)
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [embed], components: [] })
    else await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  } catch {}
}

async function handleButton(interaction) {
  const [kind, arg] = interaction.customId.split(':')
  const player = players.get(interaction.guild)

  if (kind === 'queue') {
    if (!player) throw new UserError('A fila está vazia.')
    const pages = Math.max(1, Math.ceil(player.upcoming.length / ui.PAGE))
    const page = Math.min(Math.max(1, Number(arg) || 1), pages)
    return interaction.update({ embeds: [ui.queueEmbed(player, page)], components: pages > 1 ? [ui.queuePager(page, pages)] : [] })
  }

  if (kind !== 'np') return
  requireSameChannel(interaction, player)
  switch (arg) {
    case 'toggle': player.isPaused ? player.resume() : player.pause(); break
    case 'skip': await interaction.deferUpdate(); await player.skip(); return
    case 'previous': await interaction.deferUpdate(); await player.previous(); return
    case 'shuffle': {
      const { mode } = player.shuffle()
      await interaction.reply({ embeds: [ui.info(mode === 'groups' ? '🔀 Ordem dos grupos embaralhada.' : mode === 'none' ? 'Fila curta demais para embaralhar.' : '🔀 Fila embaralhada.')], flags: MessageFlags.Ephemeral })
      return
    }
    case 'loop': player.loop = player.loop === 'off' ? 'queue' : player.loop === 'queue' ? 'track' : 'off'; break
    case 'stop': player.stop(); await replaceNowPlaying(interaction.guildId, null); return interaction.reply({ embeds: [ui.info('⏹️ Música parada e fila limpa.')] })
  }
  if (player.current) await interaction.update({ embeds: [ui.nowPlayingEmbed(player)], components: ui.controls(player) })
  else await interaction.deferUpdate()
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.inGuild()) return
  try {
    if (interaction.isAutocomplete()) {
      if (['nianplay', 'group'].includes(interaction.commandName)) await autocompletePlaylists(interaction)
      return
    }
    if (interaction.isButton()) return await handleButton(interaction)
    if (!interaction.isChatInputCommand()) return
    const handler = handlers[interaction.commandName]
    if (handler) await handler(interaction, players)
  } catch (err) {
    if (!interaction.isAutocomplete()) await replyError(interaction, err)
  }
})

// ── Voice presence: leave when alone, clean up when kicked ────────────────────
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const player = players.get(newState.guild)
  if (!player?.connection) return
  if (newState.id === client.user.id && !newState.channelId) {
    player.destroy()        // bot was disconnected/kicked
    return
  }
  const channelId = player.connection.joinConfig.channelId
  if (oldState.channelId === channelId || newState.channelId === channelId) {
    player.checkAlone(newState.guild.channels.cache.get(channelId))
  }
})

client.once(Events.ClientReady, c => {
  console.log(`NianPlay Bot online como ${c.user.tag} em ${c.guilds.cache.size} servidor(es)`)
  c.user.setActivity('/nianplay · /play', { type: ActivityType.Listening })
})

// Keep running on unexpected errors (logged), and leave voice channels cleanly on shutdown
process.on('unhandledRejection', err => console.error('unhandledRejection:', err))
process.on('uncaughtException', err => console.error('uncaughtException:', err))
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const p of playersByGuild.values()) p.destroy()
    client.destroy().finally(() => process.exit(0))
  })
}

client.login(config.token).catch(err => {
  const invalid = err?.code === 'TokenInvalid' || /token/i.test(err?.message || '')
  console.error(invalid
    ? 'O Discord recusou o DISCORD_TOKEN (inválido ou resetado). Gere um novo em Developer Portal → Bot → Reset Token e atualize o .env.'
    : `Não foi possível conectar ao Discord: ${err.message}`)
  process.exit(invalid ? CONFIG_ERROR : 1)
})
