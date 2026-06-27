const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const commandCatalog = require('../config/commandCatalog'); // Legacy, será substituído pela descoberta automática
const { getAllActions } = require('../ai/actionRegistry');

const ACTION_CATEGORY_EMOJIS = {
  'Moderação': '🛡️',
  'Mensagens': '📢',
  'Administração': '🛡️',
  'Auditoria': '🧠',
  'Testers': '📋',
  'Configuração': '⚙️',
  'Memória': '📁',
  'Lore': '🏰',
  'Cargos': '🔖',
  'Canais': '📂',
  'Utilidades': '🛠️',
  'IA': '🤖',
  'Debug': '🔧',
  'Outros': '📌',
};

const COMMAND_CATEGORY_EMOJIS = {
  'Geral': '🌐',
  'Admin': '👑',
  'IA': '🤖',
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
  const textCommands = commandCatalog.COMMANDS || [];
  const slashCommands = getSlashCommands();

  const embed = new EmbedBuilder()
    .setTitle('👑 Central de Capacidades - Royal Prussian V3')
    .setDescription('Eu possuo **Comandos** (prefixo `rp` ou `/`) e **Capacidades de IA** (linguagem natural).\nUse `rp [ação]` para me dar uma ordem direta!')
    .setColor(0x5865F2)
    .setTimestamp(new Date());

  // --- Seção de Comandos (Slash e Texto) ---
  const allCommands = [...textCommands.map(c => ({ ...c, type: 'text' })), ...slashCommands];
  if (allCommands.length > 0) {
    const commandsByCategory = {};
    allCommands.forEach(cmd => {
      const category = cmd.category || 'Outros';
      if (!commandsByCategory[category]) {
        commandsByCategory[category] = [];
      }
      commandsByCategory[category].push(cmd);
    });

    embed.addFields({ name: ' ' , value: '### ⌨️ Comandos Tradicionais (Texto & Slash)' });

    const sortedCommandCategories = Object.keys(commandsByCategory).sort();

    for (const category of sortedCommandCategories) {
      const emoji = COMMAND_CATEGORY_EMOJIS[category] || '🔹';
      const commandList = commandsByCategory[category]
        .map(cmd => `\`${cmd.type === 'slash' ? '/' : 'rp '}${cmd.name}\``)
        .join(' ');

      if (commandList) {
        embed.addFields({ name: `${emoji} ${category}`, value: commandList, inline: false });
      }
    }
  }

  // --- Seção de Capacidades da IA (Actions) ---
  const aiActions = [...getAllActions().values()]; // Converte Map para Array
  if (aiActions.length > 0) {
    const actionsByCategory = {};
    aiActions.forEach(act => {
      const category = act.category || 'Outros';
      if (!actionsByCategory[category]) actionsByCategory[category] = [];
      actionsByCategory[category].push(act);
    });

    embed.addFields({ name: ' ' , value: '### 🧠 Capacidades da IA (Ações)' });

    const sortedActionCategories = Object.keys(actionsByCategory).sort();
    for (const category of sortedActionCategories) {
      const emoji = ACTION_CATEGORY_EMOJIS[category] || '🔹';
      const actionStrings = actionsByCategory[category].map(act => {
        let actionLine = `\`${act.name}\``;
        if (act.aliases && act.aliases.length > 0) {
          actionLine += ` _(aliases: ${act.aliases.join(', ')})_`;
        }
        return actionLine;
      });

      // Para evitar exceder o limite de 1024 caracteres do campo de valor do embed
      const chunks = [];
      let currentChunk = '';
      for (const str of actionStrings) {
        if (currentChunk.length + str.length + 2 > 1024) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        currentChunk += str + '\n';
      }
      if (currentChunk) chunks.push(currentChunk);

      for (let i = 0; i < chunks.length; i++) {
        const fieldName = i === 0 ? `${emoji} ${category}` : `${emoji} ${category} (cont.)`;
        embed.addFields({ name: fieldName, value: chunks[i], inline: false });
      }
    }
  }

  const totalCommands = allCommands.length;

  embed.setFooter({
    text: `Comandos: ${totalCommands} | Ações de IA: ${aiActions.length} | Arquitetura V3`,
  });

  return embed;
}

module.exports = { generateHelpEmbed };