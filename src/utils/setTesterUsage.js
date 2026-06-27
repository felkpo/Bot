const { isAdmin } = require('../../utils/helpers');

module.exports = {
  metadata: {
    name: 'setTesterUsage',
    description: 'Define o contador de uso diário de um tester.',
    category: 'Testers',
    parameters: {
        user: { type: 'user', description: 'O usuário tester (menção ou ID).', required: true },
        amount: { type: 'number', description: 'A quantidade de usos para definir.', required: true }
    },
    aliases: ['definirUsoTester'],
    userPermissionsCheck: (message) => isAdmin(message.member),
    examples: ["rp defina o uso do @tester para 50"],
    executorName: 'setTesterUsage'
  }
};