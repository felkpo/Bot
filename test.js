require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', () => {
    console.log('ONLINE');
});

client.login(process.env.TOKEN)
    .catch(console.error);