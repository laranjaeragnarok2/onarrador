import {
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

function createAdminGuildCommand(name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild);
}

export const commands = Object.freeze([
  new SlashCommandBuilder().setName('clear_memory').setDescription('Clears the conversation history.'),
  new SlashCommandBuilder().setName('settings').setDescription('Opens up settings.'),
  createAdminGuildCommand('server_settings', 'Opens up the server settings.'),
  createAdminGuildCommand('channel_settings', 'Opens up the channel settings for this channel.'),
  createAdminGuildCommand('block', 'Blocks a user from using certain interactions.').addUserOption((option) =>
    option.setName('user').setDescription('The user to block.').setRequired(true),
  ),
  createAdminGuildCommand('unblock', 'Removes a user from the block list.').addUserOption((option) =>
    option.setName('user').setDescription('The user to unblock.').setRequired(true),
  ),
  new SlashCommandBuilder().setName('status').setDescription('Displays bot CPU and RAM usage in detail.'),
  new SlashCommandBuilder()
    .setName('wiki')
    .setDescription('Gerencia a enciclopédia/wiki da campanha de RPG.')
    .addSubcommand((sub) =>
      sub
        .setName('buscar')
        .setDescription('Busca uma página na wiki.')
        .addStringOption((opt) =>
          opt.setName('termo').setDescription('O termo ou título para buscar').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('listar')
        .setDescription('Lista todas as páginas registradas na wiki.')
        .addStringOption((opt) =>
          opt.setName('categoria')
            .setDescription('Filtrar por categoria')
            .setRequired(false)
            .addChoices(
              { name: 'NPC', value: 'NPC' },
              { name: 'Local', value: 'Local' },
              { name: 'Item', value: 'Item' },
              { name: 'Lore', value: 'Lore' },
              { name: 'Regra', value: 'Regra' },
              { name: 'Outros', value: 'Outros' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Cria uma nova página na wiki.')
        .addStringOption((opt) => opt.setName('titulo').setDescription('O título da página (único)').setRequired(true))
        .addStringOption((opt) => opt.setName('conteudo').setDescription('O conteúdo da página').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('categoria')
            .setDescription('Categoria da página')
            .setRequired(true)
            .addChoices(
              { name: 'NPC', value: 'NPC' },
              { name: 'Local', value: 'Local' },
              { name: 'Item', value: 'Item' },
              { name: 'Lore', value: 'Lore' },
              { name: 'Regra', value: 'Regra' },
              { name: 'Outros', value: 'Outros' }
            )
        )
        .addStringOption((opt) => opt.setName('aliases').setDescription('Sinônimos separados por vírgula (ex: Valdir, ferreiro)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('editar')
        .setDescription('Edita uma página existente na wiki.')
        .addStringOption((opt) => opt.setName('titulo').setDescription('O título da página para editar').setRequired(true))
        .addStringOption((opt) => opt.setName('conteudo').setDescription('O novo conteúdo da página').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('categoria')
            .setDescription('Nova categoria da página')
            .setRequired(false)
            .addChoices(
              { name: 'NPC', value: 'NPC' },
              { name: 'Local', value: 'Local' },
              { name: 'Item', value: 'Item' },
              { name: 'Lore', value: 'Lore' },
              { name: 'Regra', value: 'Regra' },
              { name: 'Outros', value: 'Outros' }
            )
        )
        .addStringOption((opt) => opt.setName('aliases').setDescription('Novos sinônimos separados por vírgula').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('deletar')
        .setDescription('Deleta uma página da wiki.')
        .addStringOption((opt) => opt.setName('titulo').setDescription('O título exato da página a ser deletada').setRequired(true))
    )
]);
