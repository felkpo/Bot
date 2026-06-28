const { isAdmin } = require('../utils/helpers');
const userGroupManager = require('../managers/userGroupManager');

module.exports = {
  metadata: {
    name: 'setUserGroup',
    description: 'Adiciona ou remove um usuário de um grupo de personalidade.',
    category: 'Administração',
    parameters: {
      action: { type: 'string', description: "A ação a ser executada: 'add' ou 'remove'.", required: true },
      group: { type: 'string', description: `O nome do grupo: '${Object.keys(userGroupManager.GROUP_ALIASES).join("', '")}'.`, required: true },
      user: { type: 'user', description: 'O usuário a ser modificado (menção ou ID).', required: true }
    },
    aliases: ['modificarGrupo'],
    userPermissionsCheck: (message) => isAdmin(message.member),
    examples: ["rp adicione o @usuario ao grupo tester", "rp remova o <@123456789012345678> do grupo servant"],
    executorName: 'setUserGroup'
  }
};