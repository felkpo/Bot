const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { COMMANDS: textCommands } = require('../config/commandCatalog');
const { TOOLS } = require('../ai/toolCatalog');

const CATEGORY_EMOJIS = {
  'Moderação': '👮',
  'Mensagens': '📢',
  'Administração': '🛡️',
  'Auditoria': '🧠',
  'Testers': '📋',
  'Configuração': '⚙️',
  'Memória': '📁',
  'Lore': '🏰',
  'Debug': '🔧',
  'Outros': '📌',
};

// Descobre dinamicamente os comandos de slash lendo a pasta /src/commands
function getSlashCommands() {
  const slashCommands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  if (!fs.existsSync(commandsPath)) return [];

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if (command.data && command.data.name) {
        slashCommands.push({
          name: command.data.name,
          description: command.data.description,
          category: command.category || 'Outros',
          type: 'slash',
          permissions: command.data.default_member_permissions ? ['Administrator'] : [],
        });
      }
    } catch (error) {
      console.error(`Erro ao carregar o comando de slash ${file}:`, error);
    }
  }
  return slashCommands;
}

/**
 * Gera um EmbedBuilder com a lista completa e automática de comandos.
 * @returns {EmbedBuilder}
 */
function generateHelpEmbed() {
  const slashCommands = getSlashCommands();
  const allCommands = [...textCommands, ...slashCommands];

  const embed = new EmbedBuilder()
    .setTitle('👑 Central de Comandos - Royal Prussian')
    .setDescription('Abaixo estão todos os comandos disponíveis. A IA também pode executar ações por linguagem natural (Action Mode).')
    .setColor(0x5865F2)
    .setTimestamp(new Date());

  const commandsByCategory = {};
  allCommands.forEach(cmd => {
    const category = cmd.category || 'Outros';
    if (!commandsByCategory[category]) {
      commandsByCategory[category] = [];
    }
    commandsByCategory[category].push(cmd);
  });

  const sortedCategories = Object.keys(commandsByCategory).sort((a, b) => {
    const order = Object.keys(CATEGORY_EMOJIS);
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  });

  for (const category of sortedCategories) {
    const emoji = CATEGORY_EMOJIS[category] || '🔹';
    const commandList = commandsByCategory[category]
      .map(cmd => `\`${cmd.type === 'slash' ? '/' : 'rp '}${cmd.name}\``)
      .join(' ');

    if (commandList) {
      embed.addFields({ name: `${emoji} ${category}`, value: commandList });
    }
  }

  const aiCapabilities = Object.entries(TOOLS)
    .filter(([key]) => key !== 'fallback_to_chat')
    .map(([, tool]) => `• ${tool.description.charAt(0).toUpperCase() + tool.description.slice(1).replace(/\.$/, '')}`);

  embed.addFields({
    name: '🤖 Capacidades da IA (Action Mode)',
    value: 'Use linguagem natural para executar ações. Ex: `rp, bana o @usuário por spam`.\n\n' + aiCapabilities.slice(0, 8).join('\n') + '\n• E muito mais...',
  });

  const totalCommands = allCommands.length;
  const totalSlash = slashCommands.length;
  const totalText = textCommands.length;
  const totalAliases = textCommands.reduce((acc, cmd) => acc + (cmd.aliases?.length || 0), 0);

  embed.setFooter({
    text: `Total: ${totalCommands} comandos | Slash: ${totalSlash} | Texto: ${totalText} | Aliases: ${totalAliases} | Categorias: ${sortedCategories.length}`,
  });

  return embed;
}

module.exports = { generateHelpEmbed };