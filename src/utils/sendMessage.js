const { isAdmin } = require('../../utils/helpers');

module.exports = {
  metadata: {
    name: 'sendMessage',
    description: 'Envia uma mensagem de texto para um canal específico no servidor.',
    category: 'Mensagens',
    parameters: {
      channel: { type: 'channel', description: 'O ID ou a menção (#canal) do canal de destino.', required: true },
      content: { type: 'string', description: 'O conteúdo da mensagem a ser enviada.', required: true }
    },
    aliases: ['falar', 'enviarMensagem'],
    permissions: ['SendMessages', 'ViewChannel'],
    userPermissionsCheck: (message) => isAdmin(message.member),
    examples: [
      "rp envie 'Olá a todos' no canal #geral",
      "rp fala 'bem-vindos' em <#123456789012345678>"
    ],
    executorName: 'sendMessage'
  }
};