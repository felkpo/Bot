require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

console.log('Iniciando bot...');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', () => {
    console.log(`Bot online como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply('Pong!');
    }
});

client.login(process.env.TOKEN);