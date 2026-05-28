require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionsBitField,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

const commandBuilders = [
    new SlashCommandBuilder().setName('ping').setDescription('Responde com Pong!'),
    new SlashCommandBuilder()
        .setName('sayrapido')
        .setDescription('Enviar uma mensagem rápida via opções do comando')
        .addChannelOption(o => o.setName('channel').setDescription('Canal para enviar a mensagem').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Mensagem que o bot deve enviar').setRequired(true)),
    new SlashCommandBuilder().setName('say').setDescription('Enviar uma mensagem via modo interativo'),
    new SlashCommandBuilder().setName('help').setDescription('Mostra todos os comandos disponíveis do bot'),
    new SlashCommandBuilder()
        .setName('addemoji')
        .setDescription('Adiciona um emoji ao servidor a partir de uma imagem (fluxo interativo)')
        .addStringOption(opt => opt.setName('name').setDescription('Nome do emoji (ex: prussia)').setRequired(true))
];

const commands = commandBuilders.map(c => c.toJSON());

if (!token) {
    console.error('Missing DISCORD_TOKEN in environment');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Collect single message from a user in a channel
function collectResponse(channel, userId, time = 60000) {
    return new Promise(resolve => {
        const filter = m => m.author.id === userId;
        let resolved = false;
        const collector = channel.createMessageCollector({ filter, time, max: 1 });
        collector.on('collect', m => {
            if (!resolved) {
                resolved = true;
                resolve(m);
            }
        });
        collector.on('end', collected => {
            if (!resolved) {
                resolved = true;
                resolve(null);
            }
        });
    });
}

function sanitizeEmojiName(name) {
    if (!name) return 'emoji';
    const s = name.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
    return s.slice(0, 32) || 'emoji';
}

function getEmojiLimit(guild) {
    const tier = (guild && guild.premiumTier) ? guild.premiumTier : 0;
    switch (tier) {
        case 3: return 250;
        case 2: return 150;
        case 1: return 100;
        default: return 50;
    }
}

async function registerCommands() {
    if (!clientId) {
        console.warn('CLIENT_ID missing — skipping command registration');
        return;
    }
    console.log('Registering global commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Commands registered.');
}

client.once(Events.ClientReady, async () => {
    console.log(`Bot online como ${client.user.tag}`);
    try { await registerCommands(); } catch (e) { console.error('Failed registering commands', e); }
});

// v14-compatible, robust /addemoji handler
async function handleAddEmoji(interaction) {
    try {
        if (!interaction.member || !interaction.member.permissions || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
            return;
        }
        if (!interaction.guild) {
            await interaction.reply({ content: 'Este comando só pode ser usado em um servidor (guild).', ephemeral: true });
            return;
        }

        const name = interaction.options.getString('name', true);
        const me = interaction.guild.members.me || interaction.guild.members.cache.get(client.user.id);
        if (!me || !me.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
            await interaction.reply({ content: 'Não tenho permissão `Manage Emojis and Stickers`.', ephemeral: true });
            return;
        }

        // ask for attachment
        await interaction.reply({ content: 'Envie a imagem do emoji como anexo (png, jpg, jpeg, gif).', ephemeral: false });
        const imageMsg = await collectResponse(interaction.channel, interaction.user.id, 30000);
        if (!imageMsg) {
            await interaction.followUp({ content: 'Tempo esgotado. Cancelando.', ephemeral: false });
            return;
        }

        if (!imageMsg.attachments || imageMsg.attachments.size === 0) {
            await interaction.followUp({ content: 'Nenhum anexo detectado. Por favor, anexe uma imagem.', ephemeral: false });
            return;
        }

        const attachment = imageMsg.attachments.first();
        console.log('addemoji: attachment:', { name: attachment.name, url: attachment.url, size: attachment.size, contentType: attachment.contentType });

        // Validate extension
        const fname = (attachment.name || attachment.url || '').toLowerCase();
        const allowed = ['.png', '.jpg', '.jpeg', '.gif'];
        if (!allowed.some(ext => fname.endsWith(ext))) {
            await interaction.followUp({ content: 'Formato inválido: apenas png, jpg, jpeg e gif são suportados.', ephemeral: false });
            return;
        }

        // size check (optional)
        const MAX_BYTES = 256 * 1024; // 256KB conservative
        if (attachment.size && attachment.size > MAX_BYTES) {
            await interaction.followUp({ content: `Arquivo muito grande: ${attachment.size} bytes (limite ${MAX_BYTES}).`, ephemeral: false });
            return;
        }

        // GIF animated check (best-effort)
        if ((attachment.contentType && attachment.contentType.includes('gif')) || fname.endsWith('.gif')) {
            if (!interaction.guild.premiumTier || interaction.guild.premiumTier === 0) {
                await interaction.followUp({ content: 'GIF animado detectado, mas o servidor não tem boosts suficientes para emojis animados.', ephemeral: false });
                return;
            }
        }

        const safeName = sanitizeEmojiName(name);
        if (!/^[a-z0-9_]{2,32}$/.test(safeName)) {
            await interaction.followUp({ content: 'Nome inválido após sanitização. Use 2-32 caracteres alfanuméricos ou underscores.', ephemeral: false });
            return;
        }

        // emoji limit check
        try {
            const existing = await interaction.guild.emojis.fetch();
            const limit = getEmojiLimit(interaction.guild);
            if (existing.size >= limit) {
                await interaction.followUp({ content: `O servidor já possui ${existing.size} emojis (limite aproximado ${limit}). Libere espaço antes de adicionar.`, ephemeral: false });
                return;
            }
        } catch (e) {
            console.warn('Não foi possível verificar emojis existentes:', e);
        }

        // Create emoji using object form (discord.js v14)
        try {
            console.log(`addemoji: creating emoji from ${attachment.url} name=${safeName}`);
            const created = await interaction.guild.emojis.create({ attachment: attachment.url, name: safeName }, { reason: `Criado por ${interaction.user.tag}` });
            console.log('addemoji: created:', created);
            await interaction.followUp({ content: `Emoji adicionado com sucesso: <:${created.name}:${created.id}>`, ephemeral: false });
            return;
        } catch (err) {
            console.error('addemoji: erro ao criar emoji (full):', err);
            const status = err && (err.status || err.httpStatus || err.statusCode);
            const msg = err && err.message ? err.message.toLowerCase() : '';
            const code = err && err.code;

            if (status === 413 || msg.includes('request entity too large') || msg.includes('file too large')) {
                await interaction.followUp({ content: 'Falha: arquivo muito grande (Discord rejeitou o upload).', ephemeral: false });
                return;
            }
            if (msg.includes('maximum number of emojis') || msg.includes('exceeded the maximum')) {
                await interaction.followUp({ content: 'Falha: limite de emojis atingido no servidor.', ephemeral: false });
                return;
            }
            if (status === 403 || msg.includes('permission')) {
                await interaction.followUp({ content: 'Falha: permissão insuficiente para criar emojis. Verifique Manage Emojis and Stickers.', ephemeral: false });
                return;
            }
            if (code === 50035 || msg.includes('invalid')) {
                await interaction.followUp({ content: 'Falha: formato de arquivo ou dados inválidos. Verifique o arquivo e o nome do emoji.', ephemeral: false });
                return;
            }

            await interaction.followUp({ content: `Erro da API do Discord: ${err.message || String(err)} (veja console para detalhes).`, ephemeral: false });
            return;
        }
    } catch (err) {
        console.error('handleAddEmoji: unexpected error', err);
        try { await interaction.followUp({ content: `Erro inesperado: ${err.message || String(err)} — ver console para detalhes.`, ephemeral: false }); } catch (e) {}
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply({ content: 'Pong!', ephemeral: true });
        return;
    }

    if (interaction.commandName === 'help') {
        const isAdmin = !!(interaction.member && interaction.member.permissions && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator));
        const emojiMap = { ping: '🏓', sayrapido: '⚡', say: '✉️', help: '❓' };
        const adminCommands = new Set(['say', 'sayrapido']);
        const visibleCommands = commands.filter(cmd => isAdmin ? true : !adminCommands.has(cmd.name));
        const embed = new EmbedBuilder().setTitle('Central de Comandos').setDescription('Lista de comandos disponíveis').setColor(0x5865F2).setTimestamp(new Date()).setFooter({ text: 'Use com responsabilidade' });
        for (const cmd of visibleCommands) {
            const emoji = emojiMap[cmd.name] || '🛠️';
            let example = `/${cmd.name}`;
            if (cmd.options && cmd.options.length > 0) example += ' ' + cmd.options.map(o => o.type === 7 ? `#${o.name}` : `<${o.name}>`).join(' ');
            embed.addFields({ name: `${emoji}  /${cmd.name}`, value: `**Descrição:** ${cmd.description}\n**Exemplo:** \`${example}\`` });
        }
        await interaction.reply({ embeds: [embed], ephemeral: false });
        return;
    }

    if (interaction.commandName === 'sayrapido') {
        if (!interaction.member || !interaction.member.permissions || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
            return;
        }
        const target = interaction.options.getChannel('channel', true);
        const message = interaction.options.getString('message', true);
        if (!target || !target.isTextBased()) return await interaction.reply({ content: 'Canal inválido.', ephemeral: true });
        const me = interaction.guild.members.me || interaction.guild.members.cache.get(client.user.id);
        if (!target.permissionsFor(me) || !target.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) return await interaction.reply({ content: 'Sem permissão para enviar mensagens nesse canal.', ephemeral: true });
        try { await target.send({ content: message }); await interaction.reply({ content: 'Mensagem enviada!', ephemeral: false }); } catch (e) { console.error('sayrapido send error', e); await interaction.reply({ content: 'Erro ao enviar mensagem.', ephemeral: true }); }
        return;
    }

    if (interaction.commandName === 'say') {
        if (!interaction.member || !interaction.member.permissions || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return await interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
        if (!interaction.channel || !interaction.channel.isTextBased()) return await interaction.reply({ content: 'Use este comando em um canal de texto.', ephemeral: true });
        await interaction.reply({ content: 'Qual canal você deseja enviar?', ephemeral: false });
        const channelAnswer = await collectResponse(interaction.channel, interaction.user.id, 60000);
        if (!channelAnswer) return await interaction.followUp({ content: 'Tempo esgotado.', ephemeral: false });
        let target = null;
        if (channelAnswer.mentions && channelAnswer.mentions.channels && channelAnswer.mentions.channels.size > 0) target = channelAnswer.mentions.channels.first();
        if (!target) {
            const raw = channelAnswer.content.trim();
            if (/^\d+$/.test(raw)) target = interaction.guild.channels.cache.get(raw);
            else target = interaction.guild.channels.cache.find(ch => ch.name === raw.replace(/^#/, '') && ch.isTextBased());
        }
        if (!target || !target.isTextBased()) return await interaction.followUp({ content: 'Canal inválido. Cancelando.', ephemeral: false });
        const me = interaction.guild.members.me || interaction.guild.members.cache.get(client.user.id);
        if (!target.permissionsFor(me) || !target.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) return await interaction.followUp({ content: 'Sem permissão para enviar mensagens nesse canal.', ephemeral: false });
        await interaction.followUp({ content: 'Qual será a mensagem?', ephemeral: false });
        const msgAnswer = await collectResponse(interaction.channel, interaction.user.id, 60000);
        if (!msgAnswer) return await interaction.followUp({ content: 'Tempo esgotado. Cancelando.', ephemeral: false });
        try {
            const sendOptions = {};
            if (msgAnswer.content) sendOptions.content = msgAnswer.content;
            if (msgAnswer.attachments && msgAnswer.attachments.size > 0) sendOptions.files = Array.from(msgAnswer.attachments.values()).map(a => a.url);
            await target.send(sendOptions);
            await interaction.followUp({ content: 'Mensagem enviada com sucesso!', ephemeral: false });
        } catch (e) {
            console.error('say send error', e);
            await interaction.followUp({ content: 'Erro ao enviar a mensagem. Verifique permissões.', ephemeral: false });
        }
        return;
    }

    if (interaction.commandName === 'addemoji') {
        await handleAddEmoji(interaction);
        return;
    }
});

client.login(token);
