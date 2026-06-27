/**
 * RESPONSE PARSER
 *
 * Responsável por analisar a resposta de texto de um LLM e tentar extrair
 * uma chamada de ação estruturada em formato JSON.
 *
 * @file src/ai/responseParser.js
 */

const logger = require('../utils/logger');

/**
 * Tenta analisar uma resposta de texto para encontrar um objeto JSON estruturado
 * que represente uma chamada de ação.
 * @param {string} text - A resposta de texto do LLM.
 * @returns {object|null} O objeto de ação analisado ou null.
 */
function tryParseStructuredResponse(text) {
  const arquivo = 'src/ai/responseParser.js';
  const funcao = 'tryParseStructuredResponse';

  if (!text || typeof text !== 'string') {
    logger.debug('[ACTION PARSER] Entrada inválida (nula ou não-string).', {
      arquivo,
      funcao,
      resultado: null
    });
    return null;
  }

  logger.info('[ACTION RAW RESPONSE]', {
    arquivo,
    funcao,
    rawResponse: text.substring(0, 500),
    rawLength: text.length
  });

  let candidate = text.trim();
  let formato = 'texto puro';

  const markdownMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (markdownMatch) {
    candidate = markdownMatch[1].trim();
    formato = 'markdown JSON';
  }

  candidate = candidate.replace(/```json/gi, '').replace(/```/g, '').trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
    if (formato === 'texto puro') formato = 'JSON extraído do texto';
  }

  try {
    const parsed = JSON.parse(candidate);

    if (typeof parsed.action !== 'string') {
        logger.warn('[ACTION PARSER] JSON válido, mas sem a chave "action" ou tipo incorreto.', {
            arquivo,
            funcao,
            parsedKeys: Object.keys(parsed)
        });
        return null;
    }

    logger.info('[ACTION PARSER SUCCESS]', {
      arquivo,
      funcao,
      acaoExtraida: parsed.action,
      formato,
    });

    return parsed;
  } catch (error) {
    logger.warn('[ACTION PARSER ERROR]', {
      arquivo,
      funcao,
      motivo: 'JSON.parse falhou',
      formato,
      candidatePreview: candidate.substring(0, 300),
      erro: error.message
    });
    return null;
  }
}

module.exports = {
    tryParseStructuredResponse,
};