# 🔧 Guia de Extensão - Royal Prussian

## Adicionando Novos Comandos

### 1. Criar um novo comando

Crie um arquivo em `src/commands/seu_comando.js`:

```javascript
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seu_comando')
    .setDescription('Descrição do comando')
    .addStringOption(opt => 
      opt.setName('parametro')
        .setDescription('Descrição do parâmetro')
        .setRequired(true)
    )
    .setDMPermission(false),
  
  async execute(interaction) {
    try {
      const parametro = interaction.options.getString('parametro');
      
      await interaction.reply({
        content: `Você digitou: ${parametro}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Erro no comando', { error: error.message });
      await interaction.reply({
        content: 'Erro ao executar comando',
        ephemeral: true
      });
    }
  }
};
```

### 2. O comando será carregado automaticamente

O arquivo `src/events/ready.js` carrega todos os comandos de `src/commands/` automaticamente.

## Modificando o Prompt da IA

Edite a função `getSystemPrompt()` em `src/ai/gemini.js`:

```javascript
getSystemPrompt() {
  return `Você é ${config.BOT_NAME}, uma assistente...
  
  Características personalizadas:
  - Sua característica 1
  - Sua característica 2
  
  Instruções personalizadas:
  - Sua instrução 1
  - Sua instrução 2`;
}
```

## Adicionando Novos Padrões de Ativação

Edite `src/config/config.js`:

```javascript
AI: {
  maxHistoryPerUser: 10,
  messageTimeout: 30000,
  cooldownMs: 2000,
  prefixes: [
    'Prussia', 
    'prussia', 
    'royal prussian', 
    'Royal Prussian', 
    'RP', 
    'rp',
    'Rp',
    'rP',
    'seu_novo_prefixo'  // Adicione aqui
  ],
}
```

## Expandindo Intenções Administrativas

Em `src/ai/adminIntentions.js`, adicione novos padrões:

```javascript
static analyzeIntent(message, member) {
  if (!isAdmin(member)) return null;

  // Novo padrão: "banco de dados"
  const dbPatterns = [
    /(?:backup|exportar|salvar)\s+(?:dados|database|db)/i
  ];

  for (const pattern of dbPatterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        type: 'database_backup',
        // dados da ação...
      };
    }
  }

  // ... resto do código
}
```

## Personalizando o Logger

O logger está em `src/utils/logger.js`. Para adicionar logging a um arquivo:

```javascript
const fs = require('fs');

class Logger {
  log(level, message, data = {}) {
    // Log existente
    if (LOG_LEVELS[level] > this.level) return;
    
    // Adicione isto:
    const logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFileSync('./logs/bot.log', logEntry);
  }
}
```

## Modificando Configurações

Edite `src/config/config.js` para alterar:

- Modelo Gemini: `GEMINI_MODEL`
- Máximo de histórico: `maxHistoryPerUser`
- Cooldown: `cooldownMs`
- Nível de log: `LOG_LEVEL`
- Features ativadas: `FEATURES`

## Adicionando um Novo Evento

Crie um arquivo em `src/events/seu_evento.js`:

```javascript
const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildCreate,  // Nome do evento
  once: false,               // true se deve disparar uma vez
  async execute(guild) {
    logger.info('Servidor adicionado', { guild: guild.name });
  }
};
```

O evento será carregado automaticamente pelo `index.js`.

## Testando Localmente

1. Configure o `.env` com credenciais de teste
2. Use o comando para desenvolvimento:
   ```bash
   npm run dev
   ```
3. Convide o bot a um servidor de teste
4. Teste seus comandos e IA

## Boas Práticas

### ✅ Recomendado
- Use `logger.info()`, `.warn()`, `.error()` para logs
- Sempre trate erros com try/catch
- Use contexto quando possível
- Mantenha nomes descritivos
- Valide entrada do usuário

### ❌ Evitar
- Não delete ou modifique arquivos de configuração diretamente
- Não ignore erros
- Não exponha informações sensíveis nos logs
- Não use variáveis globais desnecessariamente
- Não faça requisições síncronas

## Exemplo: Adicionando um Comando Admin Personalizado

```javascript
// src/commands/announce.js
const { SlashCommandBuilder } = require('discord.js');
const { isAdmin, botHasPermission } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Faz um anúncio em um canal')
    .addChannelOption(opt => 
      opt.setName('channel').setDescription('Canal').setRequired(true)
    )
    .addStringOption(opt => 
      opt.setName('message').setDescription('Mensagem').setRequired(true)
    ),
  
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      await interaction.reply({
        content: 'Apenas admin',
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    if (!botHasPermission(channel, interaction.client, 'SendMessages')) {
      await interaction.reply({
        content: 'Sem permissão',
        ephemeral: true
      });
      return;
    }

    await channel.send(message);
    logger.info('Anúncio enviado', {
      channel: channel.name,
      by: interaction.user.tag
    });

    await interaction.reply({
      content: '✅ Anúncio enviado!',
      ephemeral: false
    });
  }
};
```

---

Para mais dúvidas, consulte a documentação do Discord.js: https://discord.js.org
