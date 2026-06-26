/**
 * CATÁLOGO ÚNICO DE COMANDOS — SINGLE SOURCE OF TRUTH
 * 
 * Para adicionar um comando novo, edite APENAS este arquivo.
 * - rp help atualiza automaticamente
 * - rp debug commands atualiza automaticamente
 * - IA recebe automaticamente via prompt
 * 
 * @file src/config/commandCatalog.js
 */

const KNOWN_SERVER_COMMANDS = {
  // ═══════════════════════════════════════════════════════════════
  // GERENCIAMENTO DE GRUPOS
  // ═══════════════════════════════════════════════════════════════
  'rp add akira <usuario>': 'Adiciona usuário ao grupo Akira',
  'rp remove akira <usuario>': 'Remove usuário do grupo Akira',
  'rp add servant <usuario>': 'Adiciona usuário ao grupo Servant',
  'rp remove servant <usuario>': 'Remove usuário do grupo Servant',
  'rp add tester <usuario>': 'Adiciona usuário ao grupo Tester',
  'rp remove tester <usuario>': 'Remove usuário do grupo Tester',
  'rp add admintester <usuario>': 'Adiciona usuário ao grupo AdminTester',
  'rp remove admintester <usuario>': 'Remove usuário do grupo AdminTester',

  // ═══════════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════════
  'rp role <usuario>': 'Mostra o role do usuário',
  'rp list akira': 'Lista membros do grupo Akira',
  'rp list servant': 'Lista membros do grupo Servant',
  'rp list tester': 'Lista membros do grupo Tester',
  'rp list admintester': 'Lista membros do grupo AdminTester',

  // ═══════════════════════════════════════════════════════════════
  // DEBUG E AUDITORIA
  // ═══════════════════════════════════════════════════════════════
  'rp audit recent': 'Lista os 10 últimos eventos de auditoria capturados',
  'rp audit user <usuario>': 'Lista os últimos eventos envolvendo um usuário específico',
  'rp audit role <cargo>': 'Lista os últimos eventos envolvendo um cargo específico',
  'rp audit channel <canal>': 'Lista os últimos eventos envolvendo um canal específico',
  'rp audit bans': 'Lista as últimas adições/remoções de bans',
  'rp audit roleadd': 'Lista as últimas adições/atualizações de cargos em membros',
  'rp audit roleremove': 'Lista as últimas remoções/atualizações de cargos em membros',
  'rp audit channels': 'Lista as últimas criações/remoções/alterações de canais',
  'rp audit export': 'Gera e envia um arquivo JSON com o histórico completo de auditoria do servidor',
  'rp debug audit': 'Exibe estatísticas de memória do sistema de auditoria',
  'rp debug role': 'Mostra o role atual do usuário',
  'rp debug actions': 'Lista todas as actions registradas',
  'rp debug commands': 'Lista o catálogo completo de comandos',
  'rp debug memory': 'Mostra contexto carregado na memória',
  'rp debug access <usuario>': 'Mostra permissão de IA do usuário',
  'rp help': 'Mostra esta lista de comandos',

  // ═══════════════════════════════════════════════════════════════
  // TESTERS (LIMITES DIÁRIOS)
  // ═══════════════════════════════════════════════════════════════
  'rp tester usage <usuario>': 'Mostra quantos usos o usuário possui hoje',
  'rp tester reset <usuario>': 'Reseta o contador diário de um usuário',
  'rp tester addusage <usuario> <quantidade>': 'Adiciona usos ao contador diário',
  'rp tester removeusage <usuario> <quantidade>': 'Remove usos do contador diário',
  'rp tester setusage <usuario> <quantidade>': 'Define exatamente o valor do contador diário',

  // ═══════════════════════════════════════════════════════════════
  // GRUPOS DISPONÍVEIS
  // ═══════════════════════════════════════════════════════════════
  // akira, servant, normal, tester, admintester
};

/**
 * Retorna texto formatado do catálogo para uso em prompts da IA.
 */
function getCatalogText() {
  const lines = [];
  lines.push('=== Gerenciamento de Grupos ===');
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp add') || cmd.startsWith('rp remove')) {
      lines.push(`${cmd} — ${desc}`);
    }
  }
  lines.push('');
  lines.push('=== Testers ===');
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp tester')) {
      lines.push(`${cmd} — ${desc}`);
    }
  }
  lines.push('');
  lines.push('=== Consultas ===');
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp role') || cmd.startsWith('rp list')) {
      lines.push(`${cmd} — ${desc}`);
    }
  }
  lines.push('');
  lines.push('=== Debug ===');
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp debug') || cmd === 'rp help') {
      lines.push(`${cmd} — ${desc}`);
    }
  }
  return lines.join('\n');
}

/**
 * Retorna texto formatado do catálogo para uso em mensagens Discord (com formatação markdown).
 */
function getCatalogMarkdown() {
  const lines = ['**COMANDOS DISPONÍVEIS:**', '', '=== Grupos ==='];
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp add') || cmd.startsWith('rp remove')) {
      lines.push(`• \`${cmd}\` — ${desc}`);
    }
  }
  lines.push('', '=== Testers ===');
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp tester')) {
      lines.push(`• \`${cmd}\` — ${desc}`);
    }
  }
  lines.push('', '=== Consultas ===');
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp role') || cmd.startsWith('rp list')) {
      lines.push(`• \`${cmd}\` — ${desc}`);
    }
  }
  lines.push('', '=== Debug ===');
  for (const [cmd, desc] of Object.entries(KNOWN_SERVER_COMMANDS)) {
    if (cmd.startsWith('rp debug') || cmd === 'rp help') {
      lines.push(`• \`${cmd}\` — ${desc}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  KNOWN_SERVER_COMMANDS,
  getCatalogText,
  getCatalogMarkdown,
};