const { PermissionsBitField } = require('discord.js');

module.exports = {
  metadata: {
    name: 'kickUser',
    description: 'Expulsa um usuário do servidor. Ele poderá retornar com um novo convite.',
    category: 'Moderação',
    parameters: {
      user: { type: 'user', description: 'O usuário a ser expulso (menção ou ID).', required: true },
      reason: { type: 'string', description: 'A razão para a expulsão.', required: false }
    },
    aliases: ['expulsar'],
    permissions: ['KickMembers'],
    userPermissionsCheck: (message) => message.member.permissions.has(PermissionsBitField.Flags.KickMembers),
    examples: ["rp expulse o @usuário por comportamento inadequado"],
    executorName: 'kickUser',
    riskLevel: 'high'
  }
};