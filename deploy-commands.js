require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde com Pong!')
];
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('clientReady', () => {
    console.log(`Bot online como ${client.user.tag}`);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('Missing DISCORD_TOKEN in environment');
    process.exit(1);
}

client.login(token);