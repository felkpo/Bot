/**
 * CATÁLOGO ÚNICO DE COMANDOS — SINGLE SOURCE OF TRUTH
 * 
 * Este arquivo define todos os comandos de texto (`rp ...`).
 * O sistema de ajuda (`/help` e `rp help`) lê este arquivo dinamicamente.
 * Para adicionar ou modificar um comando de texto, edite esta lista.
 * 
 * @file src/config/commandCatalog.js
 */

const COMMANDS = [
  // Administração
  { name: 'add', category: 'Administração', syntax: 'rp add <grupo> <usuário>', description: 'Adiciona um usuário a um grupo de personalidade (akira, servant, tester, admintester).', type: 'text', permissions: ['Administrator'] },
  { name: 'remove', category: 'Administração', syntax: 'rp remove <grupo> <usuário>', description: 'Remove um usuário de um grupo de personalidade.', type: 'text', permissions: ['Administrator'] },
  { name: 'role', category: 'Administração', syntax: 'rp role <usuário>', description: 'Mostra o grupo de personalidade de um usuário.', type: 'text', permissions: ['Administrator'] },
  { name: 'list', category: 'Administração', syntax: 'rp list <grupo>', description: 'Lista todos os membros de um grupo.', type: 'text', permissions: ['Administrator'] },

  // Auditoria
  { name: 'audit recent', category: 'Auditoria', syntax: 'rp audit recent', description: 'Mostra os 10 últimos eventos de auditoria.', type: 'text', permissions: ['Administrator'] },
  { name: 'audit user', category: 'Auditoria', syntax: 'rp audit user <usuário>', description: 'Filtra a auditoria por usuário.', type: 'text', permissions: ['Administrator'] },
  { name: 'audit role', category: 'Auditoria', syntax: 'rp audit role <cargo>', description: 'Filtra a auditoria por cargo.', type: 'text', permissions: ['Administrator'] },
  { name: 'audit channel', category: 'Auditoria', syntax: 'rp audit channel <canal>', description: 'Filtra a auditoria por canal.', type: 'text', permissions: ['Administrator'] },
  { name: 'audit bans', category: 'Auditoria', syntax: 'rp audit bans', description: 'Mostra os últimos eventos de banimento.', type: 'text', permissions: ['Administrator'] },
  { name: 'audit export', category: 'Auditoria', syntax: 'rp audit export [filtro]', description: 'Exporta os logs de auditoria para um arquivo JSON.', type: 'text', permissions: ['Administrator'] },

  // Testers
  { name: 'tester usage', category: 'Testers', syntax: 'rp tester usage [@usuário]', description: 'Verifica o uso diário de um tester.', type: 'text', permissions: ['Administrator'] },
  { name: 'tester reset', category: 'Testers', syntax: 'rp tester reset <usuário>', description: 'Zera o contador de uso diário de um tester.', type: 'text', permissions: ['Administrator'] },
  { name: 'tester addusage', category: 'Testers', syntax: 'rp tester addusage <usuário> <qtd>', description: 'Adiciona usos ao contador de um tester.', type: 'text', permissions: ['Administrator'] },
  { name: 'tester setusage', category: 'Testers', syntax: 'rp tester setusage <usuário> <qtd>', description: 'Define o contador de uso de um tester.', type: 'text', permissions: ['Administrator'] },

  // Configuração
  { name: 'quickpunishment', category: 'Configuração', syntax: 'rp quickpunishment <on|off|toggle|status>', description: 'Gerencia o modo de punição rápida, que executa ações sem pedir confirmação.', type: 'text', permissions: ['Administrator'] },

  // Debug
  { name: 'debug role', category: 'Debug', syntax: 'rp debug role', description: 'Mostra seu próprio grupo de personalidade para debug.', type: 'text', permissions: ['Administrator'] },
  { name: 'debug access', category: 'Debug', syntax: 'rp debug access <usuário>', description: 'Verifica se um usuário tem acesso à IA.', type: 'text', permissions: ['Administrator'] },
  { name: 'debug audit', category: 'Debug', syntax: 'rp debug audit', description: 'Mostra estatísticas da memória de auditoria.', type: 'text', permissions: ['Administrator'] },
  { name: 'debug providers', category: 'Debug', syntax: 'rp debug providers', description: 'Mostra o status dos provedores de IA.', type: 'text', permissions: ['Administrator'] },
  { name: 'debug commands', category: 'Debug', syntax: 'rp debug commands', description: 'Lista o catálogo de comandos (versão texto).', type: 'text', permissions: ['Administrator'] },
  { name: 'debug memory', category: 'Memória', syntax: 'rp debug memory', description: 'Mostra o contexto de lore carregado na memória.', type: 'text', permissions: ['Administrator'] },

  // Lore
  { name: 'lore', category: 'Lore', syntax: 'mp <pergunta>', description: 'Ativa o modo de lore da Prússia. Use o prefixo `mp` ou `mprussia`.', type: 'text', aliases: ['mprussia'] },

  // Outros
  { name: 'help', category: 'Outros', syntax: 'rp help', description: 'Mostra este menu de ajuda.', type: 'text' },
];

module.exports = {
  COMMANDS,
};