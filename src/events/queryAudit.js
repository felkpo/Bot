const { isAdmin } = require('../utils/helpers');

module.exports = {
  metadata: {
    name: 'queryAudit',
    description: "Consulta os registros de auditoria do servidor com base em filtros.",
    category: 'Auditoria',
    parameters: {
      filter_type: { type: 'string', description: "O tipo de filtro: 'recent', 'user', 'role', 'channel'.", required: true },
      filter_value: { type: 'string', description: "O valor para o filtro (ex: ID do usuário, nome do cargo, etc). Não é necessário para 'recent'.", required: false },
      limit: { type: 'number', description: 'Número de eventos para retornar.', required: false }
    },
    aliases: ['auditar', 'verAuditoria'],
    userPermissionsCheck: (message) => isAdmin(message.member),
    examples: ["rp audite os eventos recentes", "rp me mostre a auditoria do usuário @usuario com limite de 5"],
    executorName: 'queryAudit'
  }
};