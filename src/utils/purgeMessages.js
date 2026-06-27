const { PermissionsBitField } = require('discord.js');

module.exports = {
  metadata: {
    name: 'purgeMessages',
    description: 'Apaga um número específico de mensagens de um canal.',
    category: 'Moderação',
    parameters: {
        channel: { type: 'channel', description: 'O canal onde as mensagens serão apagadas. Padrão: canal atual.', required: false },
        count: { type: 'number', description: 'O número de mensagens a serem apagadas (entre 2 e 100).', required: true }
    },
    aliases: ['limpar', 'apagarMensagens'],
    permissions: ['ManageMessages'],
    userPermissionsCheck: (message) => message.member.permissions.has(PermissionsBitField.Flags.ManageMessages),
    examples: ["rp limpe as últimas 50 mensagens", "rp apagar 10 mensagens em #off-topic"],
    executorName: 'purgeMessages',
    riskLevel: 'medium'
  }
};