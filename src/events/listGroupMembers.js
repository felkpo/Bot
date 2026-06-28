const { isAdmin } = require('../utils/helpers');
const userGroupManager = require('../managers/userGroupManager');

module.exports = {
  metadata: {
    name: 'listGroupMembers',
    description: 'Lista todos os membros de um grupo de personalidade específico.',
    category: 'Administração',
    parameters: {
      group: { type: 'string', description: "O nome do grupo para listar." }
    },
    aliases: ['listarGrupo'],
    userPermissionsCheck: (message) => isAdmin(message.member),
    examples: ["rp liste os membros do grupo admintester"],
    executorName: 'listGroupMembers'
  }
};