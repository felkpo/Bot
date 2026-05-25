require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');

console.log('Iniciando bot...');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
    console.log(`Bot online como ${client.user.tag}`);
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

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('Missing DISCORD_TOKEN in environment');
    process.exit(1);
}

client.login(token);
