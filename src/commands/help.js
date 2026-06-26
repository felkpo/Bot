const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { KNOWN_SERVER_COMMANDS } = require('../config/commandCatalog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra todos os comandos disponíveis do bot'),

  async execute(interaction) {
    const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);

    const embed = new EmbedBuilder()
      .setTitle('👑 Central de Comandos - Royal Prussian')
      .setDescription('Abaixo estão todos os comandos disponíveis, separados por categoria.')
      .setColor(0x5865F2)
      .setTimestamp(new Date())
      .setFooter({ text: 'Use com responsabilidade 👑' });

    // Comandos Slash
    const slashCommands = [
      '**/ping**: Responde com a latência do bot.',
      '**/help**: Mostra este menu de ajuda.',
    ];
    const adminSlashCommands = [
      '**/say**: Envia uma mensagem em um canal via modo interativo.',
      '**/sayrapido**: Envia uma mensagem rápida em um canal.',
      '**/addemoji**: Adiciona um novo emoji ao servidor.',
    ];

    embed.addFields({ name: 'Comandos Gerais (Slash)', value: slashCommands.join('\n') });
    if (isAdmin) {
      embed.addFields({ name: 'Administração (Slash)', value: adminSlashCommands.join('\n') });
    }

    // Comandos de IA (Texto)
    if (isAdmin) {
      const groupManagementCmds = Object.entries(KNOWN_SERVER_COMMANDS).filter(([cmd]) => cmd.includes(' add ') || cmd.includes(' remove ') || cmd.includes(' list ') || cmd.includes(' role ')).map(([cmd, desc]) => `• \`${cmd}\` — ${desc}`).join('\n');
      const auditCmds = Object.entries(KNOWN_SERVER_COMMANDS).filter(([cmd]) => cmd.includes(' audit ')).map(([cmd, desc]) => `• \`${cmd}\` — ${desc}`).join('\n');
      const testerCmds = Object.entries(KNOWN_SERVER_COMMANDS).filter(([cmd]) => cmd.includes(' tester ')).map(([cmd, desc]) => `• \`${cmd}\` — ${desc}`).join('\n');
      const debugCmds = Object.entries(KNOWN_SERVER_COMMANDS).filter(([cmd]) => cmd.includes(' debug ') || cmd.includes(' help ')).map(([cmd, desc]) => `• \`${cmd}\` — ${desc}`).join('\n');

      embed.addFields(
        { name: '🤖 Comandos de IA (Texto)', value: 'Use `rp` ou mencione o bot para usar a IA. Ex: `rp, tudo bem?`' },
        { name: '👑 Gerenciamento de Grupos', value: groupManagementCmds || 'Nenhum' },
        { name: '🔎 Auditoria', value: auditCmds || 'Nenhum' },
        { name: '🧪 Testers', value: testerCmds || 'Nenhum' },
        { name: '⚙️ Debug', value: debugCmds || 'Nenhum' }
      );
    } else {
        embed.addFields({
            name: '🤖 Modo IA - Royal Prussian',
            value: 'A IA responde quando:\n' +
                   '• O bot é mencionado\n' +
                   '• A mensagem começa com: `Prussia`, `RP`, `Royal Prussian`, etc.\n' +
                   '• Exemplo: `"RP, tudo bem?"` ou `"@Royal Prussian me ajuda"`'
        });
    }

    embed.addFields({
      name: '\n🤖 Modo IA - Royal Prussian',
      value: 'A IA responde quando:\n' +
             '• O bot é mencionado\n' +
             '• A mensagem começa com: `Prussia`, `RP`, `Royal Prussian`, etc.\n' +
             '• Exemplo: `"RP, tudo bem?"` ou `"@Royal Prussian me ajuda"`'
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
