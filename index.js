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
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde com Pong!'),
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Enviar uma mensagem (fluxo interativo)')
].map(command => command.toJSON());

if (!token) {
    console.error('Missing DISCORD_TOKEN in environment');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

async function registerCommands() {
    if (!clientId || !guildId) {
        console.warn('CLIENT_ID or GUILD_ID is missing. Skipping command registration.');
        return;
    }

    console.log('Registrando comandos de barra...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Comandos registrados com sucesso.');
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

    if (interaction.commandName === 'say') {
        if (!interaction.member || !interaction.member.permissions || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
            return;
        }

        // Ask which channel to send to (public)
        await interaction.reply({ content: 'Qual canal você deseja enviar?', ephemeral: false });

        const filter = m => m.author.id === interaction.user.id;

        // First collector: channel selection
        const channelCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

        channelCollector.on('collect', async (collected) => {
            const answer = collected.first();
            let target = null;

            // Try channel mention
            if (answer.mentions && answer.mentions.channels && answer.mentions.channels.size > 0) {
                target = answer.mentions.channels.first();
            }

            // Try ID
            if (!target) {
                const id = answer.content.trim();
                if (/^\d+$/.test(id)) {
                    target = interaction.guild.channels.cache.get(id);
                }
            }

            // Try name
            if (!target) {
                const name = answer.content.trim();
                target = interaction.guild.channels.cache.find(ch => ch.name === name || ch.name === name.replace(/^#/, ''));
            }

            if (!target || !target.isTextBased()) {
                await interaction.followUp({ content: 'Canal inválido ou não é um canal de texto. Cancelando.', ephemeral: false });
                return;
            }

            // Check bot permissions in target channel
            const me = interaction.guild.members.me || interaction.guild.members.cache.get(client.user.id);
            if (!target.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
                await interaction.followUp({ content: 'Não tenho permissão para enviar mensagens nesse canal. Cancelando.', ephemeral: false });
                return;
            }

            // Ask for the message
            await interaction.followUp({ content: 'Qual será a mensagem?', ephemeral: false });

            const messageCollector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

            messageCollector.on('collect', async (msgs) => {
                const userMsg = msgs.first();

                try {
                    const sendOptions = {};
                    if (userMsg.content) sendOptions.content = userMsg.content;
                    if (userMsg.attachments && userMsg.attachments.size > 0) sendOptions.files = Array.from(userMsg.attachments.values()).map(a => a.url);

                    await target.send(sendOptions);
                    await interaction.followUp({ content: 'Mensagem enviada com sucesso!', ephemeral: false });
                } catch (err) {
                    console.error('Erro ao enviar mensagem para o canal alvo:', err);
                    await interaction.followUp({ content: 'Erro ao enviar a mensagem. Verifique permissões e tente novamente.', ephemeral: false });
                }
            });

            messageCollector.on('end', (_, reason) => {
                if (reason === 'time') {
                    interaction.followUp({ content: 'Tempo esgotado. Cancelando.', ephemeral: false });
                }
            });
        });

        channelCollector.on('end', (_, reason) => {
            if (reason === 'time') {
                interaction.followUp({ content: 'Tempo esgotado. Cancelando.', ephemeral: false });
            }
        });
    }
});

client.login(token);
