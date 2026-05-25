require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

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

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Registrando comandos de barra...');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log('Comandos registrados com sucesso.');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
})();
