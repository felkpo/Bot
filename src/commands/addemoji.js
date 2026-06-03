const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin, collectResponse, sanitizeEmojiName, getEmojiLimit } = require('../utils/helpers');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addemoji')
    .setDescription('Adiciona um emoji ao servidor a partir de uma imagem (fluxo interativo)')
    .addStringOption(opt => 
      opt.setName('name')
        .setDescription('Nome do emoji (ex: prussia)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
    .setDMPermission(false),
  
  async execute(interaction) {
    try {
      // Verifica se é admin
      if (!isAdmin(interaction.member)) {
        await interaction.reply({ 
          content: '❌ Apenas administradores podem usar este comando.',
          ephemeral: true 
        });
        return;
      }

      if (!interaction.guild) {
        await interaction.reply({ 
          content: '❌ Este comando só pode ser usado em um servidor (guild).',
          ephemeral: true 
        });
        return;
      }

      const name = interaction.options.getString('name', true);
      const botMember = interaction.guild.members.me;

      // Verifica permissão do bot
      if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
        await interaction.reply({ 
          content: '❌ Não tenho permissão `Manage Emojis and Stickers`.',
          ephemeral: true 
        });
        return;
      }

      // Pede o arquivo
      await interaction.reply({ 
        content: '🖼️ Envie a imagem do emoji como anexo (png, jpg, jpeg, gif).',
        ephemeral: false 
      });

      const imageMsg = await collectResponse(interaction.channel, interaction.user.id, 30000);
      if (!imageMsg) {
        await interaction.followUp({ 
          content: '❌ Tempo esgotado. Cancelando.',
          ephemeral: false 
        });
        return;
      }

      // Verifica anexo
      if (!imageMsg.attachments || imageMsg.attachments.size === 0) {
        await interaction.followUp({ 
          content: '❌ Nenhum anexo detectado. Por favor, anexe uma imagem.',
          ephemeral: false 
        });
        return;
      }

      const attachment = imageMsg.attachments.first();
      logger.debug('📎 Anexo detectado', { 
        name: attachment.name, 
        size: attachment.size, 
        contentType: attachment.contentType 
      });

      // Valida extensão
      const fname = (attachment.name || attachment.url || '').toLowerCase();
      const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
      if (!allowedExtensions.some(ext => fname.endsWith(ext))) {
        await interaction.followUp({ 
          content: '❌ Formato inválido: apenas png, jpg, jpeg e gif são suportados.',
          ephemeral: false 
        });
        return;
      }

      // Verifica tamanho
      const MAX_BYTES = 256 * 1024; // 256KB
      if (attachment.size && attachment.size > MAX_BYTES) {
        await interaction.followUp({ 
          content: `❌ Arquivo muito grande: ${attachment.size} bytes (limite ${MAX_BYTES}).`,
          ephemeral: false 
        });
        return;
      }

      // Verifica se é GIF animado
      if ((attachment.contentType && attachment.contentType.includes('gif')) || fname.endsWith('.gif')) {
        if (!interaction.guild.premiumTier || interaction.guild.premiumTier === 0) {
          await interaction.followUp({ 
            content: '❌ GIF animado detectado, mas o servidor não tem boosts suficientes para emojis animados.',
            ephemeral: false 
        });
          return;
        }
      }

      // Sanitiza o nome
      const safeName = sanitizeEmojiName(name);
      if (!/^[a-z0-9_]{2,32}$/.test(safeName)) {
        await interaction.followUp({ 
          content: '❌ Nome inválido após sanitização. Use 2-32 caracteres alfanuméricos ou underscores.',
          ephemeral: false 
        });
        return;
      }

      // Verifica limite de emojis
      try {
        const existing = await interaction.guild.emojis.fetch();
        const limit = getEmojiLimit(interaction.guild);
        if (existing.size >= limit) {
          await interaction.followUp({ 
            content: `❌ O servidor já possui ${existing.size} emojis (limite ~${limit}). Libere espaço primeiro.`,
            ephemeral: false 
          });
          return;
        }
      } catch (e) {
        logger.warn('⚠️ Não foi possível verificar emojis existentes', { error: e.message });
      }

      // Cria o emoji
      try {
        logger.info('➕ Criando emoji', { name: safeName, url: attachment.url });
        const created = await interaction.guild.emojis.create({
          attachment: attachment.url,
          name: safeName
        }, `Criado por ${interaction.user.tag}`);

        logger.info('✅ Emoji criado com sucesso', { name: created.name, id: created.id });

        await interaction.followUp({ 
          content: `✅ Emoji adicionado com sucesso: <:${created.name}:${created.id}>`,
          ephemeral: false 
        });
      } catch (err) {
        logger.error('❌ Erro ao criar emoji', { error: err.message });
        
        const msg = err?.message?.toLowerCase() || '';
        const status = err?.status || err?.httpStatus || err?.statusCode;

        if (status === 413 || msg.includes('request entity too large') || msg.includes('file too large')) {
          await interaction.followUp({ 
            content: '❌ Falha: arquivo muito grande (Discord rejeitou).',
            ephemeral: false 
          });
        } else if (msg.includes('maximum number of emojis') || msg.includes('exceeded the maximum')) {
          await interaction.followUp({ 
            content: '❌ Falha: limite de emojis atingido no servidor.',
            ephemeral: false 
          });
        } else if (status === 403 || msg.includes('permission')) {
          await interaction.followUp({ 
            content: '❌ Falha: permissão insuficiente. Verifique Manage Emojis and Stickers.',
            ephemeral: false 
          });
        } else if (status === 400 || msg.includes('invalid')) {
          await interaction.followUp({ 
            content: '❌ Falha: formato ou dados inválidos. Verifique o arquivo e o nome.',
            ephemeral: false 
          });
        } else {
          await interaction.followUp({ 
            content: `❌ Erro: ${err.message || 'Desconhecido'}. Veja console para detalhes.`,
            ephemeral: false 
          });
        }
      }
    } catch (error) {
      logger.error('❌ Erro no comando addemoji', { error: error.message });
      try {
        await interaction.reply({ 
          content: '❌ Erro inesperado. Veja console para detalhes.',
          ephemeral: true 
        });
      } catch (e) {}
    }
  }
};
