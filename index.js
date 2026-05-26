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

        const allCommands = [
            {
                emoji: '🏓',
                name: '/ping',
                desc: 'Responde com Pong',
                example: '/ping',
                admin: false
            },
            {
                emoji: '⚡',
                name: '/sayrapido',
                desc: 'Envia uma mensagem rápida em um canal escolhido',
                example: '/sayrapido #canal Mensagem curta',
                admin: true
            },
            {
                emoji: '✉️',
                name: '/say',
                desc: 'Modo interativo para enviar mensagens complexas (formatação, quebras, etc.)',
                example: '/say (executa fluxo interativo)',
                admin: true
            },
            {
                emoji: '❓',
                name: '/help',
                desc: 'Mostra todos os comandos disponíveis',
                example: '/help',
                admin: false
            }
        ];

        const visible = allCommands.filter(c => isAdmin ? true : !c.admin);

        const embed = new EmbedBuilder()
            .setTitle('Central de Comandos')
            .setDescription('Lista de comandos disponíveis e exemplos de uso')
            .setColor(0x2F3136)
            .setTimestamp(new Date())
            .setFooter({ text: 'Use os comandos com responsabilidade' });

        for (const cmd of visible) {
            embed.addFields({ name: `${cmd.emoji}  ${cmd.name}`, value: `**Descrição:** ${cmd.desc}\n**Exemplo:** \`${cmd.example}\`` });
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
});

client.login(token);
