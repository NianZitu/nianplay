const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { formatTime, thumbnailOf, truncate, link, progressBar } = require('./format')

const BRAND = 0xd97706   // NianPlay amber
const SOURCE_LABEL = { youtube: 'YouTube', search: 'YouTube', spotify: 'Spotify → YouTube', nianplay: 'NianPlay', link: 'Link' }
const LOOP_LABEL = { off: 'desligada', track: 'faixa', queue: 'fila' }

const durationOf = it => it.playableDuration || it.duration || 0

function groupTag(item) {
  return item.group ? ` · 🏷️ ${item.group.name}` : ''
}

function nowPlayingEmbed(player, { withProgress = false } = {}) {
  const item = player.current
  if (!item) return new EmbedBuilder().setColor(BRAND).setDescription('Nada tocando.')
  const total = durationOf(item)
  const lines = [
    `**${link(item.title, item.url)}**`,
    item.artist ? `por ${truncate(item.artist, 80)}` : null,
    item.resolvedTitle && item.resolvedTitle !== item.title ? `🔎 encontrado no YouTube: *${truncate(item.resolvedTitle, 80)}*` : null,
  ].filter(Boolean)
  if (withProgress) lines.push('', `${progressBar(player.elapsed, total)} \`${formatTime(player.elapsed)} / ${formatTime(total)}\``)

  const embed = new EmbedBuilder()
    .setColor(BRAND)
    .setAuthor({ name: player.isPaused ? '⏸️ Pausado' : '🎶 Tocando agora' })
    .setDescription(lines.join('\n'))
    .addFields(
      { name: 'Duração', value: total ? formatTime(total) : 'ao vivo', inline: true },
      { name: 'Origem', value: SOURCE_LABEL[item.source] || 'YouTube', inline: true },
      { name: 'Na fila', value: `${player.upcoming.length}`, inline: true },
    )
  if (item.playlistName) embed.addFields({ name: 'Playlist NianPlay', value: truncate(item.playlistName, 100) + groupTag(item), inline: false })
  if (item.source === 'nianplay' && (item.gain || item.cuts?.length)) {
    const extras = [item.gain ? `ganho ${item.gain > 0 ? '+' : ''}${Number(item.gain).toFixed(1)} dB` : null, item.cuts?.length ? `${item.cuts.length} corte(s)` : null].filter(Boolean)
    embed.addFields({ name: 'Ajustes do NianPlay', value: extras.join(' · '), inline: false })
  }
  const thumb = thumbnailOf(item)
  if (thumb) embed.setThumbnail(thumb)
  embed.setFooter({ text: `Volume ${player.volume}% · Repetição ${LOOP_LABEL[player.loop]}${item.requestedBy ? ` · pedido por ${item.requestedBy}` : ''}` })
  return embed
}

function controlsRow(player) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('np:previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(player.index <= 0),
    new ButtonBuilder().setCustomId('np:toggle').setEmoji(player.isPaused ? '▶️' : '⏸️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('np:skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np:shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('np:loop').setEmoji(player.loop === 'track' ? '🔂' : '🔁')
      .setStyle(player.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('np:stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
  ).toJSON()
}

const PAGE = 10
function queueEmbed(player, page = 1) {
  const upcoming = player.upcoming
  const pages = Math.max(1, Math.ceil(upcoming.length / PAGE))
  page = Math.min(Math.max(1, page), pages)
  const slice = upcoming.slice((page - 1) * PAGE, page * PAGE)
  const total = upcoming.reduce((s, it) => s + durationOf(it), 0)
  const cur = player.current
  const lines = []
  if (cur) lines.push(`**Tocando:** ${link(cur.title, cur.url)} \`${formatTime(player.elapsed)} / ${formatTime(durationOf(cur))}\`${groupTag(cur)}`, '')
  if (!slice.length) lines.push('*A fila está vazia.*')
  slice.forEach((it, i) => {
    const pos = (page - 1) * PAGE + i + 1
    lines.push(`\`${String(pos).padStart(2, ' ')}.\` ${link(it.title, it.url)} \`${formatTime(durationOf(it))}\`${groupTag(it)}`)
  })
  return new EmbedBuilder()
    .setColor(BRAND)
    .setTitle(`Fila — ${upcoming.length} faixa${upcoming.length !== 1 ? 's' : ''}`)
    .setDescription(lines.join('\n').slice(0, 4000))
    .setFooter({ text: `Página ${page}/${pages} · ${formatTime(total)} restantes · repetição ${LOOP_LABEL[player.loop]}` })
}

function queuePager(page, pages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`queue:${page - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`queue:${page + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  ).toJSON()
}

const info = (text) => new EmbedBuilder().setColor(BRAND).setDescription(text)
const error = (text) => new EmbedBuilder().setColor(0xdc2626).setDescription(`❌ ${text}`)

module.exports = { nowPlayingEmbed, controlsRow, queueEmbed, queuePager, info, error, PAGE, durationOf, LOOP_LABEL, BRAND }
