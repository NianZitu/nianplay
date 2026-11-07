// Slash commands: definitions (registered by deploy-commands.js) and handlers.
const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { resolveInput } = require('./sources/resolve')
const nianplay = require('./sources/nianplay')
const { groupedOrder } = require('./queue/grouping')
const { formatTime, parseTime, truncate, link } = require('./ui/format')
const ui = require('./ui/embeds')

const LOOP_LABEL = ui.LOOP_LABEL

// ── Definitions ───────────────────────────────────────────────────────────────
const playlistOption = o => o.setName('playlist')
  .setDescription('Link copiado no NianPlay (nianplay://playlist/...) ou o nome da playlist')
  .setRequired(true).setAutocomplete(true)

const definitions = [
  new SlashCommandBuilder().setName('play').setDescription('Toca uma música ou playlist (nome, YouTube, Spotify ou link)')
    .addStringOption(o => o.setName('busca').setDescription('Nome da música ou link do YouTube/Spotify').setRequired(true)),
  new SlashCommandBuilder().setName('playnext').setDescription('Coloca uma música para tocar logo em seguida')
    .addStringOption(o => o.setName('busca').setDescription('Nome da música ou link').setRequired(true)),
  new SlashCommandBuilder().setName('nianplay').setDescription('Toca uma playlist da nuvem do NianPlay, na ordem da playlist')
    .addStringOption(playlistOption),
  new SlashCommandBuilder().setName('group').setDescription('Toca uma playlist do NianPlay com os grupos de sequência ativos')
    .addStringOption(playlistOption),
  new SlashCommandBuilder().setName('pause').setDescription('Pausa a música'),
  new SlashCommandBuilder().setName('resume').setDescription('Continua a música pausada'),
  new SlashCommandBuilder().setName('skip').setDescription('Pula a música atual')
    .addIntegerOption(o => o.setName('quantidade').setDescription('Quantas músicas pular (padrão 1)').setMinValue(1)),
  new SlashCommandBuilder().setName('previous').setDescription('Volta para a música anterior'),
  new SlashCommandBuilder().setName('stop').setDescription('Para a música e limpa a fila'),
  new SlashCommandBuilder().setName('leave').setDescription('Sai do canal de voz'),
  new SlashCommandBuilder().setName('queue').setDescription('Mostra a fila')
    .addIntegerOption(o => o.setName('pagina').setDescription('Página da fila').setMinValue(1)),
  new SlashCommandBuilder().setName('nowplaying').setDescription('Mostra a música que está tocando'),
  new SlashCommandBuilder().setName('shuffle').setDescription('Embaralha a fila (no modo grupo, embaralha só a ordem dos grupos)'),
  new SlashCommandBuilder().setName('loop').setDescription('Repetição: desligada, faixa ou fila')
    .addStringOption(o => o.setName('modo').setDescription('Modo de repetição').setRequired(true)
      .addChoices({ name: 'desligada', value: 'off' }, { name: 'faixa atual', value: 'track' }, { name: 'fila inteira', value: 'queue' })),
  new SlashCommandBuilder().setName('volume').setDescription('Ajusta o volume (0 a 200%)')
    .addIntegerOption(o => o.setName('valor').setDescription('Volume em %').setMinValue(0).setMaxValue(200).setRequired(true)),
  new SlashCommandBuilder().setName('seek').setDescription('Vai para um ponto da música (ex.: 1:30 ou 90)')
    .addStringOption(o => o.setName('tempo').setDescription('mm:ss ou segundos').setRequired(true)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove uma música da fila')
    .addIntegerOption(o => o.setName('posicao').setDescription('Posição na fila (veja /queue)').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('move').setDescription('Muda uma música de posição na fila')
    .addIntegerOption(o => o.setName('de').setDescription('Posição atual').setMinValue(1).setRequired(true))
    .addIntegerOption(o => o.setName('para').setDescription('Nova posição').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('skipto').setDescription('Pula direto para uma posição da fila')
    .addIntegerOption(o => o.setName('posicao').setDescription('Posição na fila').setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Limpa a fila (mantém a música atual)'),
  new SlashCommandBuilder().setName('lyrics').setDescription('Mostra a letra da música atual'),
  new SlashCommandBuilder().setName('help').setDescription('Lista os comandos do bot'),
].map(c => c.setDMPermission(false).toJSON())

// ── Helpers ───────────────────────────────────────────────────────────────────
class UserError extends Error {}

function voiceChannelOf(interaction, player) {
  const channel = interaction.member?.voice?.channel
  if (!channel) throw new UserError('Entre em um canal de voz primeiro.')
  const botChannelId = player?.connection?.joinConfig?.channelId
  if (botChannelId && botChannelId !== channel.id && player.current) {
    throw new UserError(`Estou tocando em <#${botChannelId}>. Entre lá para controlar a música.`)
  }
  return channel
}

// Controls require being in the bot's channel (when it is in one)
function requireSameChannel(interaction, player) {
  if (!player?.connection) throw new UserError('Não estou tocando nada.')
  const botChannelId = player.connection.joinConfig.channelId
  if (interaction.member?.voice?.channelId !== botChannelId) {
    throw new UserError(`Entre em <#${botChannelId}> para controlar a música.`)
  }
}

function requireCurrent(player) {
  if (!player?.current) throw new UserError('Nada tocando agora.')
}

const requester = interaction => interaction.member?.displayName || interaction.user.username

async function addAndReport(interaction, players, items, { title = '', next = false, extra = '' } = {}) {
  const player = players.get(interaction.guild, { create: true })
  const channel = voiceChannelOf(interaction, player)
  await player.connect(channel, interaction.channel)
  const wasIdle = !player.current
  const { added, truncated } = await player.enqueue(items, { next, requestedBy: requester(interaction) })
  const first = items[0]
  let text
  if (added === 1 && !title) {
    text = wasIdle ? `▶️ Tocando **${link(first.title, first.url)}**` : `➕ ${next ? 'Em seguida' : 'Adicionado à fila'}: **${link(first.title, first.url)}** \`${formatTime(first.duration)}\``
  } else {
    text = `➕ ${added} faixa${added !== 1 ? 's' : ''} de **${truncate(title || 'playlist', 80)}** ${next ? 'em seguida' : 'na fila'}`
  }
  if (truncated) text += `\n⚠️ ${truncated} faixa(s) não couberam (limite da fila).`
  if (extra) text += `\n${extra}`
  await interaction.editReply({ embeds: [ui.info(text)] })
}

// ── NianPlay playlists ────────────────────────────────────────────────────────
async function playNianplay(interaction, players, { withGroups }) {
  await interaction.deferReply()
  const input = interaction.options.getString('playlist', true)
  const playlist = await nianplay.findPlaylist(input).catch(e => { throw new UserError(e.message) })
  if (!playlist.tracks.length) throw new UserError(`A playlist **${playlist.name}** está vazia.`)

  let items = playlist.tracks.map(t => nianplay.toQueueItem(t, playlist, { withGroup: withGroups }))
  const groupCount = new Set(items.filter(i => i.group).map(i => i.group.key)).size
  if (withGroups) {
    if (!groupCount) throw new UserError(`A playlist **${playlist.name}** não tem grupos. Use /nianplay para tocá-la normalmente.`)
    items = groupedOrder(items, playlist.groups.map(g => `${playlist.id}:${g.name}`))
  }
  const withoutLink = items.filter(i => !i.url).length
  const notes = []
  if (withGroups) notes.push(`🏷️ Modo grupo: ${groupCount} grupo(s) em sequência. /shuffle embaralha só a ordem dos grupos.`)
  if (withoutLink) notes.push(`🔎 ${withoutLink} faixa(s) sem link salvo serão procuradas no YouTube pelo nome (use "Verificar links" no NianPlay para melhorar).`)
  await addAndReport(interaction, players, items, { title: `${playlist.name}${playlist.owner ? ` (de ${playlist.owner})` : ''}`, extra: notes.join('\n') })
}

async function autocompletePlaylists(interaction) {
  const focused = interaction.options.getFocused() || ''
  // A pasted link/id: offer it as is
  const id = nianplay.parsePlaylistId(focused)
  let list
  try {
    list = id ? [await nianplay.getPlaylist(id)] : await nianplay.searchPlaylists(focused, 25)
  } catch {
    list = []
  }
  const day = ts => ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''
  await interaction.respond(list.slice(0, 25).map(p => ({
    name: truncate(`${p.name} — ${p.tracks.length} faixas${p.owner ? ` · ${p.owner}` : ''}${p.updatedAt ? ` · ${day(p.updatedAt)}` : ''}`, 100),
    value: p.id,
  })))
}

// ── Lyrics ────────────────────────────────────────────────────────────────────
async function fetchLyrics(item) {
  if (item.lyrics) return item.lyrics
  const clean = s => (s || '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/official|video|audio|lyrics?|hd|4k/gi, '').trim()
  let artist = item.artist, title = item.title
  if (!artist && / - /.test(title)) [artist, title] = title.split(' - ', 2)
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(clean(artist) || 'unknown')}/${encodeURIComponent(clean(title))}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null)
  const data = res?.ok ? await res.json().catch(() => ({})) : {}
  return (data.lyrics || '').trim()
}

// ── Handlers ──────────────────────────────────────────────────────────────────
const handlers = {
  async play(interaction, players) {
    await interaction.deferReply()
    const { title, items } = await resolveInput(interaction.options.getString('busca', true)).catch(e => { throw new UserError(e.message) })
    await addAndReport(interaction, players, items, { title })
  },

  async playnext(interaction, players) {
    await interaction.deferReply()
    const { title, items } = await resolveInput(interaction.options.getString('busca', true)).catch(e => { throw new UserError(e.message) })
    await addAndReport(interaction, players, items, { title, next: true })
  },

  nianplay: (i, p) => playNianplay(i, p, { withGroups: false }),
  group:    (i, p) => playNianplay(i, p, { withGroups: true }),

  async pause(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player); requireCurrent(player)
    player.pause()
    await interaction.reply({ embeds: [ui.info('⏸️ Pausado.')] })
  },

  async resume(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player); requireCurrent(player)
    player.resume()
    await interaction.reply({ embeds: [ui.info('▶️ Continuando.')] })
  },

  async skip(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player); requireCurrent(player)
    const n = interaction.options.getInteger('quantidade') || 1
    const title = player.current.title
    await interaction.deferReply()
    await player.skip(n)
    await interaction.editReply({ embeds: [ui.info(n > 1 ? `⏭️ ${n} faixas puladas.` : `⏭️ Pulada: **${truncate(title, 80)}**`)] })
  },

  async previous(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    await interaction.deferReply()
    const ok = await player.previous()
    await interaction.editReply({ embeds: [ok ? ui.info('⏮️ Voltando para a anterior.') : ui.error('Não há música anterior.')] })
  },

  async stop(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    player.stop()
    await interaction.reply({ embeds: [ui.info('⏹️ Música parada e fila limpa.')] })
  },

  async leave(interaction, players) {
    const player = players.get(interaction.guild)
    if (!player?.connection) throw new UserError('Não estou em nenhum canal.')
    requireSameChannel(interaction, player)
    player.destroy()
    await interaction.reply({ embeds: [ui.info('👋 Saí do canal.')] })
  },

  async queue(interaction, players) {
    const player = players.get(interaction.guild)
    if (!player?.current && !player?.upcoming.length) throw new UserError('A fila está vazia.')
    const pages = Math.max(1, Math.ceil(player.upcoming.length / ui.PAGE))
    const page = Math.min(interaction.options.getInteger('pagina') || 1, pages)
    await interaction.reply({ embeds: [ui.queueEmbed(player, page)], components: pages > 1 ? [ui.queuePager(page, pages)] : [] })
  },

  async nowplaying(interaction, players) {
    const player = players.get(interaction.guild); requireCurrent(player)
    await interaction.reply({ embeds: [ui.nowPlayingEmbed(player, { withProgress: true })], components: [ui.controlsRow(player)] })
  },

  async shuffle(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    const { mode, count } = player.shuffle()
    const text = mode === 'none' ? 'Não há músicas suficientes na fila para embaralhar.'
      : mode === 'groups' ? `🔀 Ordem dos grupos embaralhada (${count} faixas). Cada grupo continua na sua sequência e as músicas avulsas foram intercaladas.`
      : `🔀 Fila embaralhada (${count} faixas).`
    await interaction.reply({ embeds: [ui.info(text)] })
  },

  async loop(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    player.loop = interaction.options.getString('modo', true)
    await interaction.reply({ embeds: [ui.info(`🔁 Repetição: **${LOOP_LABEL[player.loop]}**.`)] })
  },

  async volume(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    const v = player.setVolume(interaction.options.getInteger('valor', true))
    await interaction.reply({ embeds: [ui.info(`🔊 Volume: **${v}%**`)] })
  },

  async seek(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player); requireCurrent(player)
    const secs = parseTime(interaction.options.getString('tempo', true))
    if (secs === null) throw new UserError('Tempo inválido. Use mm:ss (ex.: 1:30) ou segundos (ex.: 90).')
    await interaction.deferReply()
    const at = await player.seek(secs)
    await interaction.editReply({ embeds: [at === false ? ui.error('Ainda carregando a música, tente de novo.') : ui.info(`⏩ Indo para \`${formatTime(at)}\`.`)] })
  },

  async remove(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    const it = player.remove(interaction.options.getInteger('posicao', true))
    if (!it) throw new UserError('Posição inválida. Veja as posições em /queue.')
    await interaction.reply({ embeds: [ui.info(`🗑️ Removida: **${truncate(it.title, 80)}**`)] })
  },

  async move(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    const from = interaction.options.getInteger('de', true), to = interaction.options.getInteger('para', true)
    const it = player.move(from, to)
    if (!it) throw new UserError('Posição inválida. Veja as posições em /queue.')
    await interaction.reply({ embeds: [ui.info(`↕️ **${truncate(it.title, 80)}** movida para a posição ${to}.`)] })
  },

  async skipto(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    await interaction.deferReply()
    const it = await player.skipTo(interaction.options.getInteger('posicao', true))
    if (!it) throw new UserError('Posição inválida. Veja as posições em /queue.')
    await interaction.editReply({ embeds: [ui.info(`⏭️ Pulando para **${truncate(it.title, 80)}**`)] })
  },

  async clear(interaction, players) {
    const player = players.get(interaction.guild); requireSameChannel(interaction, player)
    const n = player.clearUpcoming()
    await interaction.reply({ embeds: [ui.info(`🧹 ${n} faixa(s) removida(s) da fila.`)] })
  },

  async lyrics(interaction, players) {
    const player = players.get(interaction.guild); requireCurrent(player)
    await interaction.deferReply()
    const item = player.current
    const text = await fetchLyrics(item)
    if (!text) throw new UserError(`Não encontrei a letra de **${truncate(item.title, 80)}**.`)
    const embed = ui.info(text.slice(0, 4000) + (text.length > 4000 ? '\n…' : ''))
      .setTitle(`Letra — ${truncate(item.title, 200)}`)
      .setFooter({ text: item.lyrics ? 'Letra salva no NianPlay' : 'Fonte: lyrics.ovh' })
    await interaction.editReply({ embeds: [embed] })
  },

  async help(interaction) {
    const lines = [
      '**Tocar**',
      '`/play` nome ou link (YouTube, playlist do YouTube, Spotify faixa/álbum/playlist e outros sites)',
      '`/playnext` igual ao /play, mas toca logo em seguida',
      '`/nianplay` playlist da nuvem do NianPlay na ordem — cole o link do app ou digite o nome',
      '`/group` playlist do NianPlay com os grupos de sequência ativos',
      '',
      '**Controle**',
      '`/pause` `/resume` `/skip` `/previous` `/stop` `/leave` `/seek` `/volume`',
      '`/loop` desligada, faixa ou fila',
      '`/shuffle` embaralha a fila — no modo grupo, embaralha só a ordem dos grupos e intercala as avulsas',
      '',
      '**Fila**',
      '`/queue` `/nowplaying` `/remove` `/move` `/skipto` `/clear` `/lyrics`',
      '',
      'No NianPlay: abra a playlist, clique em 🔗 **Copiar link do bot** e cole no `/nianplay` ou `/group`. A playlist precisa ter sido enviada para a nuvem.',
    ]
    await interaction.reply({ embeds: [ui.info(lines.join('\n')).setTitle('NianPlay Bot — comandos')], flags: MessageFlags.Ephemeral })
  },
}

module.exports = { definitions, handlers, autocompletePlaylists, UserError, requireSameChannel }
