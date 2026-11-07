// Registers the slash commands with Discord. Run once after install and whenever commands change:
//   npm run deploy-commands
// With DISCORD_GUILD_ID set, commands appear instantly in that server (good for testing);
// without it they are registered globally (all servers; can take up to ~1 hour to show up).
const { REST, Routes } = require('discord.js')
const config = require('./config')
const { definitions } = require('./commands')

;(async () => {
  if (!config.token || !config.clientId) {
    console.error('Preencha DISCORD_TOKEN e DISCORD_CLIENT_ID no .env')
    process.exit(1)
  }
  const rest = new REST().setToken(config.token)
  const route = config.devGuildId
    ? Routes.applicationGuildCommands(config.clientId, config.devGuildId)
    : Routes.applicationCommands(config.clientId)
  const data = await rest.put(route, { body: definitions })
  console.log(`${data.length} comandos registrados ${config.devGuildId ? `no servidor ${config.devGuildId}` : 'globalmente'}.`)
})().catch(err => { console.error('Falha ao registrar comandos:', err.message); process.exit(1) })
