const { PermissionsBitField } = require('discord.js');

module.exports = {
  metadata: {
    name: 'banUser',
    description: 'Bane permanentemente um usuário do servidor.',
    category: 'Moderação',
    parameters: {
      user: { type: 'user', description: 'O usuário a ser banido (menção ou ID).', required: true },
      reason: { type: 'string', description: 'A razão para o banimento.', required: false }
    },
    aliases: ['banir'],
    permissions: ['BanMembers'],
    userPermissionsCheck: (message) => message.member.permissions.has(PermissionsBitField.Flags.BanMembers),
    examples: [
      "rp bane o @usuário por spam",
      "rp banir <@123456789012345678> motivo: quebrou as regras"
    ],
    executorName: 'banUser',
    riskLevel: 'high'
  }
};