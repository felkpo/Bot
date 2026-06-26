/**
 * CATÁLOGO DE FERRAMENTAS — SINGLE SOURCE OF TRUTH
 * 
 * Define todas as ferramentas que o bot pode executar.
 * Este catálogo é injetado dinamicamente no prompt da IA quando o Action Mode é ativado.
 * Para adicionar uma nova capacidade, basta adicioná-la a este objeto.
 * 
 * @file src/ai/toolCatalog.js
 */

const TOOLS = {
  send_message: {
    description: "Envia uma mensagem de texto para um canal específico no servidor.",
    params: {
      channel: "O ID ou a menção (#canal) do canal de destino.",
      message: "O conteúdo da mensagem a ser enviada.",
      embed: "(Opcional) Um objeto JSON representando um embed para enviar em vez de texto simples."
    }
  },
  send_dm: {
    description: "Envia uma mensagem direta (DM) para um usuário específico.",
    params: {
      user: "O ID ou a menção (@usuário) do usuário de destino.",
      message: "O conteúdo da mensagem a ser enviada."
    }
  },
  purge_messages: {
    description: "Apaga um número específico de mensagens de um canal.",
    params: {
      channel: "O ID ou menção do canal onde as mensagens serão apagadas. Padrão: canal atual.",
      count: "O número de mensagens a serem apagadas (entre 2 e 100)."
    }
  },
  ban_user: {
    description: "Bane permanentemente um usuário do servidor.",
    params: {
      user: "O ID ou menção do usuário a ser banido.",
      reason: "(Opcional) A razão para o banimento, que será registrada na auditoria."
    }
  },
  unban_user: {
    description: "Remove o banimento de um usuário, permitindo que ele retorne ao servidor.",
    params: {
      user_id: "O ID numérico do usuário a ser desbanido. Menções não funcionam aqui."
    }
  },
  kick_user: {
    description: "Expulsa um usuário do servidor. Ele poderá retornar com um novo convite.",
    params: {
      user: "O ID ou menção do usuário a ser expulso.",
      reason: "(Opcional) A razão para a expulsão."
    }
  },
  timeout_user: {
    description: "Silencia um usuário por um período de tempo (timeout).",
    params: {
      user: "O ID ou menção do usuário a ser silenciado.",
      duration: "A duração do silêncio (ex: '5m' para 5 minutos, '1h' para 1 hora, '1d' para 1 dia).",
      reason: "(Opcional) A razão para o silenciamento."
    }
  },
  untimeout_user: {
    description: "Remove o silenciamento (timeout) de um usuário.",
    params: {
      user: "O ID ou menção do usuário para remover o timeout."
    }
  },
  warn_user: {
    description: "Aplica uma advertência a um usuário.",
    params: {
      user: "O ID ou menção do usuário a ser advertido.",
      reason: "A razão da advertência. É obrigatória."
    }
  },
  // Adicione outras ferramentas como add_role, create_channel, etc. aqui
  audit_query: {
    description: "Consulta os registros de auditoria do servidor com base em filtros.",
    params: {
      filter_type: "O tipo de filtro: 'user', 'role', 'channel', 'action', 'timeframe'.",
      filter_value: "O valor para o filtro (ex: ID do usuário, nome da ação, '24h')."
    }
  },
  fallback_to_chat: {
    description: "Use esta ação se e SOMENTE SE nenhuma outra ferramenta for adequada para a solicitação do usuário. Isso passará a solicitação para o modo de conversação normal.",
    params: {
      reason: "Uma breve explicação do motivo pelo qual nenhuma ferramenta foi adequada."
    }
  }
};

/**
 * Gera uma representação em texto do catálogo de ferramentas para ser injetada no prompt do LLM.
 * @returns {string} O catálogo de ferramentas formatado.
 */
function getToolCatalogForPrompt() {
  let catalogText = '## CATÁLOGO DE FERRAMENTAS DISPONÍVEIS\n\n';
  catalogText += 'Você tem acesso às seguintes ferramentas. Você DEVE usar o formato JSON para chamar uma delas.\n\n';

  for (const toolName in TOOLS) {
    const tool = TOOLS[toolName];
    catalogText += `### Ferramenta: ${toolName}\n`;
    catalogText += `- Descrição: ${tool.description}\n`;
    catalogText += `- Parâmetros:\n`;
    for (const paramName in tool.params) {
      const paramDesc = tool.params[paramName];
      catalogText += `  - ${paramName}: ${paramDesc}\n`;
    }
    catalogText += '\n';
  }
  return catalogText;
}

module.exports = {
  TOOLS,
  getToolCatalogForPrompt,
};