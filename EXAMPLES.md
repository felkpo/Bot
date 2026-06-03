# 📚 Exemplos de Uso - Royal Prussian

## Ativando a IA

### Exemplo 1: Menção Direta
```
Usuário: @Royal Prussian tudo bem?
Bot: Oi! Tudo certo por aqui! 😊 Como posso ajudar?
```

### Exemplo 2: Prefixo "RP"
```
Usuário: RP, qual é o melhor editor de código?
Bot: Visual Studio Code é excelente para desenvolvimento. Tem muitas extensões e é muito rápido...
```

### Exemplo 3: Prefixo "Prussia"
```
Usuário: Prussia como faço um ticket de suporte?
Bot: Para criar um ticket, você pode... [resposta contextual]
```

### Exemplo 4: Com Vírgula
```
Usuário: Royal Prussian, me explica como funciona este servidor?
Bot: Claro! Este é um servidor dedicado a... [resposta]
```

## Conversas Contextuadas

### Conversa com Memória
```
Usuário: RP, qual meu nome?
Bot: Desculpe, não tenho informação sobre seu nome. Como posso chamá-lo?

Usuário: Meu nome é João
Bot: Prazer em conhecê-lo, João! 😊

[Depois em outra conversa na mesma sessão]
Usuário: RP, qual é meu nome novamente?
Bot: Seu nome é João, se não me engano! Como posso ajudar?
```

## Intenções Administrativas

### Enviar Mensagem em Canal
```
Admin: Prussia, envie "Boa noite pessoal!" no canal anúncios
Bot: Você deseja enviar a seguinte mensagem no canal #anúncios?

🌙 Boa noite pessoal!

Responda SIM para confirmar.

Admin: SIM
Bot: ✅ Mensagem enviada com sucesso!
```

### Anúncio com Emojis
```
Admin: Prussia mande um anúncio no canal geral
Bot: [Aguardando mais detalhes...]
[Mesma interação com confirmação]
```

## Comandos Slash

### /ping
```
Usuário: /ping
Bot: 🏓 Pong! Latência: 45ms
```

### /help
```
Usuário: /help
Bot: [Embed mostrando todos os comandos]
```

### /sayrapido
```
Admin: /sayrapido #canal "Olá pessoal!"
Bot: ✅ Mensagem enviada com sucesso em #canal!
```

### /say (Modo Interativo)
```
Admin: /say
Bot: 📍 Qual canal você deseja enviar a mensagem?
Admin: #geral
Bot: 💬 Qual será a mensagem?
Admin: Olá galera!
Bot: ✅ Mensagem enviada com sucesso!
```

### /addemoji
```
Admin: /addemoji prussia
Bot: 🖼️ Envie a imagem do emoji como anexo (png, jpg, jpeg, gif).
[Admin envia arquivo]
Bot: ✅ Emoji adicionado com sucesso: <:prussia:123456789>
```

## Respostas Inteligentes da IA

### Pergunta Técnica
```
Usuário: RP como faço para aprender programação?
Bot: Ótima pergunta! Aqui estão algumas dicas:
1. 📚 Comece com o básico (variáveis, loops, condições)
2. 💻 Pratique codificando todos os dias
3. 🎮 Faça pequenos projetos para reforçar
4. 🌐 Participe de comunidades
5. 📖 Leia documentação e tutoriais

Qual linguagem você está pensando em aprender?
```

### Pergunta sobre o Servidor
```
Usuário: rp qual é o horário do evento?
Bot: Desculpe, não tenho informação atualizada sobre eventos. 
Verifique o canal #eventos ou pergunte para um admin! 📌
```

### Saudação
```
Usuário: Prussia oi!
Bot: Oi! Bem-vindo! 👋 Tudo bem? Como posso ajudar?
```

### Pergunta Complexa
```
Usuário: RP me explica a diferença entre programação síncrona e assíncrona
Bot: Ótima pergunta! 🧠

**Programação Síncrona:**
- Executa linha por linha
- Aguarda cada operação terminar
- Mais simples de entender
- Pode "travar" em operações longas

**Programação Assíncrona:**
- Executa múltiplas operações simultaneamente
- Não aguarda uma terminar para iniciar outra
- Mais eficiente para I/O
- Mais complexa de implementar

**Exemplo prático:**
Síncrona: Você espera a pizza ficar pronta antes de fazer outra coisa
Assíncrona: Você pede pizza e continua limpando a casa enquanto aguarda

Ficou claro? 😊
```

## Tratamento de Erros

### API Gemini Indisponível
```
Usuário: RP, tudo bem?
Bot: ❌ Desculpe, tive um problema ao processar sua mensagem. Tente novamente em alguns momentos.
```

### Limite de Requisições Excedido
```
Usuário: [muitas mensagens rápido]
Bot: [Bot entra em cooldown e não responde]
[Após cooldown]
Bot: ✅ Pronto para conversar novamente!
```

### Permissão Insuficiente
```
Admin: /sayrapido #canal-privado "Mensagem"
Bot: ❌ Não tenho permissão para enviar mensagens em #canal-privado.
```

## Proteções em Ação

### Ignorando Bot
```
[Bot A]: Olá pessoal!
Royal Prussian: [Nenhuma resposta - ignora outros bots]
```

### Cooldown por Usuário
```
Usuário: RP oi
Bot: Oi! 😊
Usuário: [imediatamente] RP oi novamente
Bot: [Sem resposta - em cooldown]
[Após 2 segundos]
Usuário: RP oi novamente
Bot: Oi! 😊
```

### Limite de Contexto
```
[Após 10 mensagens no histórico]
Usuário: RP qual foi a primeira coisa que falei?
Bot: Desculpe, não consigo lembrar de mensagens muito antigas.
       Meu histórico é limitado para otimizar recursos.
```

---

## Dicas para Testar

1. **Teste com Prefixos Diferentes**
   - `RP`, `rp`, `Rp`, `rP`
   - `Prussia`, `prussia`
   - `Royal Prussian`, `royal prussian`

2. **Teste com Menção**
   - `@Royal Prussian tudo bem?`
   - Responda em thread

3. **Teste Intenções Admin**
   - Envie mensagens complexas
   - Veja se o bot pede confirmação

4. **Teste Proteções**
   - Envie muitas mensagens rápido
   - Veja se o cooldown funciona
   - Teste com outro bot

5. **Teste Comandos**
   - Use `/help` para ver todos
   - Teste com e sem permissões

---

**Royal Prussian está pronta para servir!** 👑
