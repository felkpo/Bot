const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra todos os comandos disponíveis do bot'),
  
  async execute(interaction) {
    const isAdmin = !!(interaction.member && interaction.member.permissions && 
                       interaction.member.permissions.has(PermissionsBitField.Flags.Administrator));
    
    const emojiMap = {
      ping: '🏓',
      sayrapido: '⚡',
      say: '✉️',
      help: '❓',
      addemoji: '😀'
    };

    const commands = [
      { name: 'ping', description: 'Responde com Pong!', admin: false },
      { name: 'help', description: 'Mostra este menu de ajuda', admin: false },
      { name: 'sayrapido', description: 'Enviar uma mensagem rápida via opções do comando', admin: true },
      { name: 'say', description: 'Enviar uma mensagem via modo interativo', admin: true },
      { name: 'addemoji', description: 'Adiciona um emoji ao servidor a partir de uma imagem', admin: true }
    ];

    const visibleCommands = commands.filter(cmd => isAdmin ? true : !cmd.admin);
    
    const embed = new EmbedBuilder()
      .setTitle('👑 Central de Comandos - Royal Prussian')
      .setDescription('Lista de comandos disponíveis no servidor')
      .setColor(0x5865F2)
      .setTimestamp(new Date())
      .setFooter({ text: 'Use com responsabilidade 👑' });

    for (const cmd of visibleCommands) {
      const emoji = emojiMap[cmd.name] || '🛠️';
      const adminTag = cmd.admin ? ' (⚙️ Admin)' : '';
      embed.addFields({
        name: `${emoji}  /${cmd.name}${adminTag}`,
        value: cmd.description
      });
    }

    // Adiciona informações sobre a IA
    embed.addFields({
      name: '\n🤖 Modo IA - Royal Prussian',
      value: 'A IA responde quando:\n' +
             '• O bot é mencionado\n' +
             '• A mensagem começa com: `Prussia`, `RP`, `Royal Prussian`, etc.\n' +
             '• Exemplo: `"RP, tudo bem?"` ou `"@Royal Prussian me ajuda"`'
    });

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
