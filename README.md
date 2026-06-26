# 👑 Royal Prussian - Assistente Virtual com IA

Bot Discord com inteligência artificial usando Discord.js v14 e Google Gemini API.

## ✨ Recursos

- 🤖 **IA Inteligente**: Integração com Google Gemini para respostas naturais
- 💬 **Conversas Contextuadas**: Mantém histórico de conversas por usuário
- 🛡️ **Proteção**: Cooldown, ignorar bots, limites de requisições
- ⚙️ **Intenções Administrativas**: Reconhece comandos administrativos e pede confirmação
- 🎮 **Slash Commands**: Comandos modernos do Discord.js v14
- 📝 **Logs Detalhados**: Sistema completo de logging
- 🌐 **Múltiplos Servidores**: Compatível com vários servidores Discord

## 🚀 Instalação

### Pré-requisitos
- Node.js 18+
- NPM ou Yarn
- Conta Discord Developer
- Google Gemini API Key

### Passos

1. **Clone ou copie o repositório**
   ```bash
   cd Royal Prussian
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o arquivo .env**
   ```bash
   cp .env.example .env
   ```
   
   Edite o arquivo `.env` com suas credenciais:
   ```
   DISCORD_TOKEN=seu_token_bot_discord
   CLIENT_ID=seu_client_id_discord
   GEMINI_API_KEY=sua_chave_api_gemini
   LOG_LEVEL=info
   ```

4. **Inicie o bot**
   ```bash
   npm start
   ```

   Para desenvolvimento com auto-reload:
   ```bash
   npm run dev
   ```

## 🔧 Configuração

### Discord Developer Portal

1. Vá para [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação
3. Na aba "Bot", crie um novo bot
4. Copie o **TOKEN** para `DISCORD_TOKEN`
5. Na aba "General Information", copie o **APPLICATION ID** para `CLIENT_ID`
6. Em "OAuth2" → "URL Generator", selecione:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Read Messages/View Channels`, `Manage Emojis and Stickers`, `Read Message History`
7. Use a URL gerada para convidar o bot ao seu servidor

### Google Gemini API

1. Vá para [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crie uma nova chave de API
3. Copie para `GEMINI_API_KEY` no arquivo `.env`

## 💬 Como Usar a IA

A IA responde quando:

### Menção
- `@Royal Prussian tudo bem?`
- `@Royal Prussian me ajuda`

### Prefixos (case-insensitive)
- `rp tudo bem?`
- `prussia qual o horário?`

### Com Vírgula
- `rp, tudo bem?`
- `prussia, como funciona?`

## 🎮 Comandos

### Usuários
- `/ping` - Responde com Pong! e latência
- `/help` - Mostra todos os comandos disponíveis

### Administradores
- `/sayrapido #canal mensagem` - Envia uma mensagem rápida
- `/say` - Modo interativo para enviar mensagens
- `/addemoji nome` - Adiciona emoji ao servidor (fluxo interativo)

## ⚙️ Intenções Administrativas

Quando um administrador escreve:

```
prussia, envie boa noite no canal anúncios
```

O bot:
1. Reconhece a intenção
2. Verifica permissões
3. Gera uma prévia
4. Pede confirmação
5. Executa a ação

## 📁 Estrutura de Pastas

```
Royal Prussian/
├── src/
│   ├── commands/         # Comandos slash
│   │   ├── ping.js
│   │   ├── help.js
│   │   ├── say.js
│   │   ├── sayrapido.js
│   │   └── addemoji.js
│   ├── events/           # Eventos Discord
│   │   ├── ready.js
│   │   ├── interactionCreate.js
│   │   └── messageCreate.js
│   ├── ai/               # Módulos de IA
│   │   ├── gemini.js
│   │   ├── contextManager.js
│   │   └── adminIntentions.js
│   ├── utils/            # Funções auxiliares
│   │   ├── logger.js
│   │   ├── helpers.js
│   │   └── regex.js
│   └── config/           # Configuração
│       └── config.js
├── index.js              # Arquivo principal
├── package.json
├── .env.example
└── README.md
```

## 🛡️ Recursos de Proteção

### Cooldown
- Limite de requisições por usuário (2 segundos por padrão)
- Configurável em `src/config/config.js`

### Ignorar Bots
- Mensagens de outros bots são ignoradas automaticamente
- Evita loops infinitos

### Limite de Contexto
- Máximo 10 mensagens por usuário no histórico
- Evita consumo excessivo de tokens

## 📊 Logs

O bot gera logs detalhados com informações sobre:
- IA inicializada
- Mensagens recebidas
- Respostas geradas
- Ações administrativas
- Erros e exceções
- Tempo de resposta

Configure o nível de log em `.env`:
- `error` - Apenas erros
- `warn` - Avisos e erros
- `info` - Informações, avisos e erros (padrão)
- `debug` - Todos os detalhes

## 🎯 Personalidade da IA

A IA foi configurada para ser:
- ✨ Amigável e educada
- 🧠 Inteligente e descontraída
- 🗣️ Falante em português
- 😊 Usando emojis ocasionalmente
- 👑 Se apresentando como "Royal Prussian"

## 🐛 Troubleshooting

### Bot não responde
- Verifique se o `DISCORD_TOKEN` está correto
- Verifique se o bot tem mensagens "Read Message History"
- Verifique se a IA está habilitada (`FEATURES.AI_ENABLED`)

### IA não responde
- Verifique se `GEMINI_API_KEY` está correto
- Verifique limite de requisições da API Gemini
- Verifique os logs para erros específicos

### Comando não funciona
- Verifique se o `CLIENT_ID` está correto
- Aguarde alguns minutos para os comandos serem registrados
- Recrie o bot no Discord Developer Portal

## 📝 Notas

- Compatible com Railway e outras plataformas de hospedagem
- Todos os slash commands funcionam normalmente
- IA não quebra funcionalidades existentes
- Contexto é mantido por usuário e servidor

## 📄 Licença

Desenvolvido para Eclipse Labs

## 🤝 Suporte

Para dúvidas ou problemas, consulte os logs do bot ou verifique as configurações.

---

**Royal Prussian** - Seu assistente virtual no Discord 👑
