require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionsBitField,
    PermissionFlagsBits
    ,EmbedBuilder
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

/**
 * Command definitions (organized)
 * Keep SlashCommandBuilder objects here and convert to JSON when registering.
 */
const commandBuilders = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde com Pong!'),

    new SlashCommandBuilder()
        .setName('sayrapido')
        .setDescription('Enviar uma mensagem rápida via opções do comando')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Canal para enviar a mensagem')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Mensagem que o bot deve enviar')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Enviar uma mensagem via modo interativo'),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra todos os comandos disponíveis do bot')
    ,
    new SlashCommandBuilder()
        .setName('addemoji')
        .setDescription('Adiciona um emoji ao servidor a partir de uma imagem (fluxo interativo)')
        .addStringOption(opt =>
            opt
                .setName('name')
                .setDescription('Nome do emoji (ex: prussia)')
                .setRequired(true)
        )
];

const commands = commandBuilders.map(c => c.toJSON());

if (!token) {
    console.error('Missing DISCORD_TOKEN in environment');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Helper to collect a single message from a specific user in a channel
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

// Sanitize emoji name to valid characters and length
function sanitizeEmojiName(name) {
    if (!name) return 'emoji';
    // replace spaces with underscore, keep alphanumeric and underscores
    const s = name.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
    return s.slice(0, 32) || 'emoji';
}

// Estimate emoji limit based on guild premium tier
function getEmojiLimit(guild) {
    // Guild premium tiers: 0=None,1=Tier1,2=Tier2,3=Tier3
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
        console.warn('CLIENT_ID is missing. Skipping command registration.');
        return;
    }

    /*
      NOTE: Guild (server) commands vs Global (application) commands

      - Guild commands (Routes.applicationGuildCommands) register commands
        only for a specific guild. They update instantly and are useful for
        development and testing.

      - Global/application commands (Routes.applicationCommands) register
        commands for the entire application and become available in every
        server where the bot is present. They can take up to an hour to
        propagate across Discord.

      We're using global commands so that slash commands work in all servers
      where the bot is invited. Keep in mind propagation delay when changing
      command definitions.
    */

    console.log('Registrando comandos globais...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Comandos registrados com sucesso!');
}

client.once(Events.ClientReady, async () => {
    console.log(`Bot online como ${client.user.tag}`);

    try {
        await registerCommands();
    } catch (error) {
        console.error('Erro ao registrar comandos de barra:', error);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply({ content: 'Pong!', ephemeral: true });
        return;
    }

    if (interaction.commandName === 'help') {
        const isAdmin = !!(interaction.member && interaction.member.permissions && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator));

        // Map for emojis for known commands; fallback to a generic icon
        const emojiMap = {
            ping: '🏓',
            sayrapido: '⚡',
            say: '✉️',
            help: '❓'
        };

        // Commands that require admin privileges
        const adminCommands = new Set(['say', 'sayrapido']);

        // Use the registered command JSON to build the help list so it's
        // automatically updated when you change `commandBuilders` above.
        const visibleCommands = commands.filter(cmd => isAdmin ? true : !adminCommands.has(cmd.name));

        const embed = new EmbedBuilder()
            .setTitle('Central de Comandos')
            .setDescription('Lista de comandos disponíveis e exemplos de uso')
            .setColor(0x5865F2)
            .setTimestamp(new Date())
            .setFooter({ text: 'Use os comandos com responsabilidade' });

        for (const cmd of visibleCommands) {
            const emoji = emojiMap[cmd.name] || '🛠️';

            // Build a simple example string based on options
            let example = `/${cmd.name}`;
            if (cmd.options && cmd.options.length > 0) {
                const parts = cmd.options.map(opt => {
                    const n = opt.name;
                    if (opt.type === 7) return `#${n}`; // CHANNEL
                    return `<${n}>`;
                });
                example += ' ' + parts.join(' ');
            }

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

        if (!target || !target.isTextBased()) {
            await interaction.reply({ content: 'Canal inválido ou não é um canal de texto.', ephemeral: true });
            return;
        }

        const me = interaction.guild.members.me || interaction.guild.members.cache.get(client.user.id);
        if (!target.permissionsFor(me) || !target.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
            await interaction.reply({ content: 'Não tenho permissão para enviar mensagens nesse canal.', ephemeral: true });
            return;
        }

        try {
            await target.send({ content: message });
            await interaction.reply({ content: 'Mensagem enviada com sucesso!', ephemeral: false });
        } catch (err) {
            console.error('Erro ao enviar mensagem no modo rápido:', err);
            await interaction.reply({ content: 'Erro ao enviar a mensagem. Verifique permissões e tente novamente.', ephemeral: false });
        }
        return;
    }

    if (interaction.commandName === 'say') {
        if (!interaction.member || !interaction.member.permissions || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
            return;
        }

        if (!interaction.channel || !interaction.channel.isTextBased()) {
            await interaction.reply({ content: 'Este comando deve ser usado em um canal de texto.', ephemeral: true });
            return;
        }

        // Step 1: ask which channel
        await interaction.reply({ content: 'Qual canal você deseja enviar?', ephemeral: false });

        const channelAnswer = await collectResponse(interaction.channel, interaction.user.id, 60000);
        if (!channelAnswer) {
            await interaction.followUp({ content: 'Tempo esgotado. Cancelando.', ephemeral: false });
            return;
        }

        let target = null;
        if (channelAnswer.mentions && channelAnswer.mentions.channels && channelAnswer.mentions.channels.size > 0) {
            target = channelAnswer.mentions.channels.first();
        }

        if (!target) {
            const raw = channelAnswer.content.trim();
            if (/^\d+$/.test(raw)) target = interaction.guild.channels.cache.get(raw);
            else {
                const name = raw.replace(/^#/, '');
                target = interaction.guild.channels.cache.find(ch => ch.name === name && ch.isTextBased());
            }
        }

        if (!target || !target.isTextBased()) {
            await interaction.followUp({ content: 'Canal inválido ou não é um canal de texto. Cancelando.', ephemeral: false });
            return;
        }

        const me = interaction.guild.members.me || interaction.guild.members.cache.get(client.user.id);
        if (!target.permissionsFor(me) || !target.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
            await interaction.followUp({ content: 'Não tenho permissão para enviar mensagens nesse canal. Cancelando.', ephemeral: false });
            return;
        }

        // Step 2: ask for the message content
        await interaction.followUp({ content: 'Qual será a mensagem?', ephemeral: false });

        const msgAnswer = await collectResponse(interaction.channel, interaction.user.id, 60000);
        if (!msgAnswer) {
            await interaction.followUp({ content: 'Tempo esgotado. Cancelando.', ephemeral: false });
            return;
        }

        try {
            const sendOptions = {};
            if (msgAnswer.content) sendOptions.content = msgAnswer.content;
            if (msgAnswer.attachments && msgAnswer.attachments.size > 0) sendOptions.files = Array.from(msgAnswer.attachments.values()).map(a => a.url);

            await target.send(sendOptions);
            await interaction.followUp({ content: 'Mensagem enviada com sucesso!', ephemeral: false });
        } catch (err) {
            console.error('Erro ao enviar mensagem para o canal alvo:', err);
            await interaction.followUp({ content: 'Erro ao enviar a mensagem. Verifique permissões e tente novamente.', ephemeral: false });
        }
    }

    if (interaction.commandName === 'addemoji') {
        // Admin check
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

        // Check emoji limit using guild's premium tier for a more accurate cap
        try {
            const existing = await interaction.guild.emojis.fetch();
            const limit = getEmojiLimit(interaction.guild);
            if (existing.size >= limit) {
                await interaction.reply({ content: `O servidor já possui ${existing.size} emojis e o limite aproximado é ${limit}. Libere espaço antes de adicionar.`, ephemeral: true });
                return;
            }
        } catch (err) {
            console.warn('Não foi possível verificar emojis existentes:', err);
            // proceed — creation will fail if over limit
        }

        // Ask the user to send the image
        await interaction.reply({ content: 'Envie a imagem do emoji (png, jpg, jpeg, gif) — como anexo ou link.', ephemeral: false });

        const imageMsg = await collectResponse(interaction.channel, interaction.user.id, 30000);
        if (!imageMsg) {
            await interaction.followUp({ content: 'Tempo esgotado. Cancelando.', ephemeral: false });
            return;
        }

        // Determine image URL: prefer attachment, fallback to URL in message
        let url = null;
        if (imageMsg.attachments && imageMsg.attachments.size > 0) {
            url = imageMsg.attachments.first().url;
        } else {
            // try to find URL in content
            const urlMatch = (imageMsg.content || '').trim().match(/https?:\/\/[^\s]+/i);
            if (urlMatch) url = urlMatch[0];
        }

        if (!url) {
            await interaction.followUp({ content: 'Nenhum arquivo ou link detectado. Certifique-se de anexar ou enviar uma URL válida. Cancelando.', ephemeral: false });
            return;
        }

        const lower = (imageMsg.attachments && imageMsg.attachments.size > 0 && imageMsg.attachments.first().name) ? imageMsg.attachments.first().name.toLowerCase() : url.toLowerCase();
        const allowed = ['.png', '.jpg', '.jpeg', '.gif'];
        if (!allowed.some(ext => lower.endsWith(ext))) {
            await interaction.followUp({ content: 'Arquivo não suportado. Aceitamos: png, jpg, jpeg, gif.', ephemeral: false });
            return;
        }

        // Helpers for validation and fetching
        const MAX_EMOJI_BYTES = 256 * 1024; // 256 KB conservative limit

        function validateEmojiName(orig) {
            const safe = sanitizeEmojiName(orig);
            const ok = /^[a-z0-9_]{2,32}$/.test(safe);
            if (!ok) return { valid: false, reason: 'Nome inválido: deve ter 2-32 caracteres alfanuméricos/underscore.', safe };
            if (safe !== orig.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '')) {
                // sanitized changed input — warn but still use safe name
                return { valid: true, reason: 'Nome ajustado para caracteres válidos.', safe };
            }
            return { valid: true, reason: null, safe };
        }

        async function headFetch(url) {
            try {
                if (typeof fetch === 'function') {
                    const res = await fetch(url, { method: 'HEAD' });
                    if (!res.ok) return { ok: false };
                    return { ok: true, size: res.headers.get('content-length') ? parseInt(res.headers.get('content-length'), 10) : null, type: res.headers.get('content-type') };
                } else {
                    // fallback: no HEAD available
                    return { ok: false };
                }
            } catch (e) {
                return { ok: false };
            }
        }

        async function fetchBuffer(url, maxBytes = MAX_EMOJI_BYTES + 1) {
            if (typeof fetch === 'function') {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${url}`);
                const ab = await res.arrayBuffer();
                const buf = Buffer.from(ab);
                return buf;
            }
            // If no fetch, try https get full buffer (not implemented fallback)
            throw new Error('fetch unavailable');
        }

        function isGifAnimated(buffer) {
            try {
                let frames = 0;
                for (let i = 0; i < buffer.length - 2; i++) {
                    if (buffer[i] === 0x21 && buffer[i + 1] === 0xF9 && buffer[i + 2] === 0x04) {
                        frames++;
                        if (frames > 1) return true;
                    }
                }
                return false;
            } catch (e) {
                return false;
            }
        }

        // Validate name
        const nameCheck = validateEmojiName(name);
        if (!nameCheck.valid) {
            await interaction.followUp({ content: `Nome inválido: ${nameCheck.reason}`, ephemeral: true });
            return;
        }

        const safeName = nameCheck.safe;

        // If attachment present, use its metadata to validate size/type
        let contentType = null;
        let sizeBytes = null;
        let buffer = null;

        try {
            if (imageMsg.attachments && imageMsg.attachments.size > 0) {
                const att = imageMsg.attachments.first();
                sizeBytes = att.size || null;
                contentType = att.contentType || (att.name ? (att.name.toLowerCase().endsWith('.gif') ? 'image/gif' : att.name.toLowerCase().endsWith('.png') ? 'image/png' : att.name.toLowerCase().endsWith('.jpg') || att.name.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : null) : null);
                if (sizeBytes && sizeBytes > MAX_EMOJI_BYTES) {
                    await interaction.followUp({ content: `Arquivo muito grande: o limite aproximado é ${MAX_EMOJI_BYTES} bytes. Arquivo tem ${sizeBytes} bytes.`, ephemeral: false });
                    return;
                }
                // fetch buffer to inspect GIF animation if GIF
                try {
                    buffer = await fetchBuffer(att.url, MAX_EMOJI_BYTES + 1);
                    if (!sizeBytes) sizeBytes = buffer.length;
                    if (sizeBytes > MAX_EMOJI_BYTES) {
                        await interaction.followUp({ content: `Arquivo muito grande após download: ${sizeBytes} bytes (limite ${MAX_EMOJI_BYTES}).`, ephemeral: false });
                        return;
                    }
                } catch (e) {
                    console.warn('Não foi possível baixar attachment para validação:', e);
                }
            } else {
                // external URL: try HEAD first
                const head = await headFetch(url);
                if (head.ok) {
                    sizeBytes = head.size;
                    contentType = head.type;
                    if (sizeBytes && sizeBytes > MAX_EMOJI_BYTES) {
                        await interaction.followUp({ content: `Arquivo muito grande: o limite aproximado é ${MAX_EMOJI_BYTES} bytes. Arquivo tem ${sizeBytes} bytes.`, ephemeral: false });
                        return;
                    }
                }

                // fetch buffer to inspect content type/animation if needed
                try {
                    buffer = await fetchBuffer(url, MAX_EMOJI_BYTES + 1);
                    if (buffer && buffer.length > MAX_EMOJI_BYTES) {
                        await interaction.followUp({ content: `Arquivo muito grande após download: ${buffer.length} bytes (limite ${MAX_EMOJI_BYTES}).`, ephemeral: false });
                        return;
                    }
                } catch (e) {
                    console.warn('Erro ao baixar arquivo para validação:', e);
                    await interaction.followUp({ content: 'Não foi possível baixar o arquivo para validação. Verifique a URL e tente novamente.', ephemeral: false });
                    return;
                }
            }

            // Validate content type / extension
            const lowerName = (imageMsg.attachments && imageMsg.attachments.size > 0 && imageMsg.attachments.first().name) ? imageMsg.attachments.first().name.toLowerCase() : url.toLowerCase();
            const allowedExt = ['.png', '.jpg', '.jpeg', '.gif'];
            if (!allowedExt.some(ext => lowerName.endsWith(ext))) {
                await interaction.followUp({ content: 'Formato inválido: aceitamos png, jpg, jpeg, gif.', ephemeral: false });
                return;
            }

            // Check GIF animation vs guild boosts
            if ((contentType && contentType.includes('gif')) || lowerName.endsWith('.gif')) {
                const animated = buffer ? isGifAnimated(buffer) : true; // assume animated if we couldn't inspect
                if (animated && (!interaction.guild.premiumTier || interaction.guild.premiumTier === 0)) {
                    await interaction.followUp({ content: 'GIF animado detectado, mas o servidor não tem boosts suficientes para emojis animados. Peça para aumentar o nível de boost.', ephemeral: false });
                    return;
                }
            }

            // Finally attempt creation with detailed try/catch
            try {
                const created = await interaction.guild.emojis.create(url, safeName, { reason: `Criado por ${interaction.user.tag}` });
                await interaction.followUp({ content: `Emoji adicionado com sucesso: <:${created.name}:${created.id}>`, ephemeral: false });
            } catch (err) {
                // Detailed error analysis
                console.error('Erro completo ao criar emoji:', err);
                // Discord API HTTP status checks
                const status = err && err.status ? err.status : err && err.httpStatus ? err.httpStatus : null;
                const code = err && err.code ? err.code : null;

                if (status === 413) {
                    await interaction.followUp({ content: 'Falha: arquivo muito grande (resposta 413 do Discord).', ephemeral: false });
                    return;
                }

                if (code === 50035) {
                    await interaction.followUp({ content: 'Falha: dados inválidos enviados para a API do Discord (50035). Verifique o nome do emoji ou o arquivo.', ephemeral: false });
                    return;
                }

                // Generic message parsing
                const msg = (err && err.message) ? err.message.toLowerCase() : '';
                if (msg.includes('maximum number of emojis') || msg.includes('exceeded the maximum')) {
                    await interaction.followUp({ content: 'Falha: limite de emojis atingido no servidor.', ephemeral: false });
                    return;
                }

                if (msg.includes('permission') || status === 403) {
                    await interaction.followUp({ content: 'Falha: permissão insuficiente para criar emojis. Necessário Manage Emojis and Stickers.', ephemeral: false });
                    return;
                }

                // Fallback: show API error message for debugging
                await interaction.followUp({ content: `Erro da API do Discord: ${err.message || String(err)} (ver console para detalhes)`, ephemeral: false });
            }

        } catch (err) {
            console.error('Erro durante validação/adicionar emoji:', err);
            await interaction.followUp({ content: `Erro inesperado: ${err.message || String(err)} — ver console para detalhes.`, ephemeral: false });
            return;
        }
    }
});

client.login(token);
