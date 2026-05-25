require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder
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
        .setDescription('Enviar uma mensagem em outro canal')
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
        )
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
        const targetChannel = interaction.options.getChannel('channel', true);
        const message = interaction.options.getString('message', true);

        if (!targetChannel || !targetChannel.isTextBased()) {
            await interaction.reply({
                content: 'Por favor escolha um canal de texto válido.',
                ephemeral: true
            });
            return;
        }

        await targetChannel.send({ content: message });
        await interaction.reply({ content: 'Mensagem enviada!', ephemeral: true });
    }
});

client.login(token);
