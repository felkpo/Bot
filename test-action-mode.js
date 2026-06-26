require('dotenv').config();
const GeminiProvider = require('./src/ai/gemini-provider');

async function testActionMode() {
  const provider = new GeminiProvider();
  await provider.init();

  if (!provider.isAvailable) {
    console.error('Gemini Provider is not available. Please check GEMINI_API_KEY.');
    process.exit(1);
  }

  const systemPrompt = `ACTION MODE - FONTE DE VERDADE DAS ACOES

Voce NAO decide quais acoes existem.
Voce NAO decide quais permissoes possui.
Voce NAO decide o que consegue ou nao consegue fazer.

As acoes abaixo sao IMPLEMENTADAS no sistema. Se uma acao estiver listada, assuma que ela EXISTE e PODE ser executada.

Nunca responda:
- "nao tenho permissao"
- "nao consigo fazer isso"
- "essa acao nao existe"
- "nao tenho acesso"

Sua unica funcao: converter o pedido do usuario para JSON.

## FORMATO OBRIGATORIO

{ "action": "...", "params": {} }

Nunca utilize "message" ou "content" fora de params.
Nunca utilize texto explicativo, markdown ou blocos de codigo.
Retorne SOMENTE JSON.

## ACOES IMPLEMENTADAS

purge_messages -> { "action": "purge_messages", "params": { "count": <numero> } }  // também aceita "amount" ou "limit"
`;

  const userMessage = "apaga 11 msgs";

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  console.log('Sending Action Mode request to Gemini API...');
  
  const result = await provider.generate(userMessage, messages, 30000);

  if (!result.ok) {
    console.error('API Error:', result.reason, result.apiMessage || '');
    process.exit(1);
  }

  console.log('--- RESPONSE TEXT ---');
  console.log(result.text);
  console.log('---------------------');

  try {
    // Strip markdown code blocks if any
    let cleanedText = result.text.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
    
    const parsed = JSON.parse(cleanedText);

    if (parsed.action === 'purge_messages' && parsed.params && parsed.params.count === 11) {
      console.log('✅ TEST PASSED: Returned valid JSON with purge_messages action.');
      process.exit(0);
    } else if (parsed.action === 'send_message') {
      console.error('❌ TEST FAILED: Model fell back to send_message action.');
      process.exit(1);
    } else {
      console.error('❌ TEST FAILED: Unexpected JSON output:', parsed);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ TEST FAILED: Response is not valid JSON.', error.message);
    if (result.text.toLowerCase().includes('permissão') || result.text.toLowerCase().includes('permissao')) {
      console.error('Model hallucinated a permission error!');
    }
    process.exit(1);
  }
}

testActionMode();