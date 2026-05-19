/**
 * Slash command interaction handlers.
 * Each exported function corresponds to a registered slash command.
 */

import { MessageFlags } from 'discord.js';
import { OSUtils } from 'node-os-utils';

import config from '../../config.js';
import {
  addBlacklistedUser,
  clearChatHistoryFor,
  getTimeUntilNextReset,
  removeBlacklistedUser,
  shouldShowActionButtons,
  state,
} from '../state/botState.js';
import { getActiveSessionDetails } from '../services/sessionService.js';
import {
  STATUS_LIFETIME_MS,
  STATUS_REFRESH_INTERVAL_MS,
} from '../constants.js';
import { addSettingsButton } from '../ui/messageActions.js';
import { showDashboard, showChannelDashboard, showSettings } from '../ui/settingsViews.js';
import { applyEmbedFallback, createStatusEmbed, replyWithEmbed } from '../utils/discord.js';
import { replyWithError, logError } from '../utils/errorHandler.js';
import {
  ensureInteractionNotBlacklisted,
  getClearMemoryDisabledReason,
  persistStateChange,
  requireGuildAdmin,
  replyFeatureDisabled,
} from './interactionHelpers.js';
import {
  getWikiEntry,
  createWikiEntry,
  editWikiEntry,
  deleteWikiEntry,
  listWikiEntries,
} from '../services/wikiService.js';

const osu = new OSUtils();

function getMonitorData(result, label) {
  if (!result.success) {
    const reason = result.error?.message || 'Unknown monitor error';
    throw new Error(`Failed to fetch ${label}: ${reason}`);
  }

  return result.data;
}

async function handleClearMemoryCommand(interaction) {
  const disabledReason = getClearMemoryDisabledReason(interaction);
  if (disabledReason) {
    return replyFeatureDisabled(interaction, disabledReason);
  }

  const activeSession = getActiveSessionDetails(interaction.user.id);

  clearChatHistoryFor(activeSession.historyId);
  await persistStateChange();

  return replyWithEmbed(interaction, {
    variant: 'success',
    title: 'Chat History Cleared',
    description: `Cleared history for session **${activeSession.sessionName}** (ID: ${activeSession.sessionId}).`,
  });
}

async function handleStatusCommand(interaction) {
  await interaction.deferReply();
  let intervalId;

  const updateReply = async () => {
    try {
      const [memoryResult, cpuResult] = await Promise.all([
        osu.memory.info(),
        osu.cpu.usage(),
      ]);
      const memoryInfo = getMonitorData(memoryResult, 'memory info');
      const cpuPercentage = getMonitorData(cpuResult, 'CPU usage');

      await interaction.editReply(applyEmbedFallback(interaction.channel, {
        embeds: [createStatusEmbed({
          variant: 'primary',
          title: 'System Information',
          fields: [
            {
              name: 'Memory (RAM)',
              value: `Total Memory: \`${memoryInfo.total.toMB().toFixed(0)}\` MB\nUsed Memory: \`${memoryInfo.used.toMB().toFixed(0)}\` MB\nFree Memory: \`${memoryInfo.free.toMB().toFixed(0)}\` MB\nPercentage Of Free Memory: \`${memoryInfo.free.toBytes() > 0 && memoryInfo.total.toBytes() > 0 ? ((memoryInfo.free.toBytes() / memoryInfo.total.toBytes()) * 100).toFixed(2) : '0.00'}\`%`,
              inline: true,
            },
            {
              name: 'CPU',
              value: `Percentage of CPU Usage: \`${cpuPercentage.toFixed(2)}\`%`,
              inline: true,
            },
            {
              name: 'Time Until Next Reset',
              value: getTimeUntilNextReset(),
              inline: true,
            },
            {
              name: 'Cota da API Gemini (Hoje)',
              value: `Requisições hoje: \`${state.quotaUsage?.count || 0}\` / \`${config.quotaLimits?.maxRequestsPerDay || 'Ilimitado'}\`\nLimite por Minuto: \`${config.quotaLimits?.maxRequestsPerMinute || 360}\` RPM`,
              inline: true,
            },
          ],
        })],
      }));
    } catch (error) {
      logError('StatusCommandUpdate', error, {
        userId: interaction.user?.id,
        interactionId: interaction.id,
      });
      clearInterval(intervalId);
    }
  };

  try {
    await updateReply();
    const reply = await interaction.fetchReply();
    if (shouldShowActionButtons(interaction.guild?.id, interaction.user.id, interaction.channelId)) {
      await addSettingsButton(reply);
    }
    intervalId = setInterval(updateReply, STATUS_REFRESH_INTERVAL_MS);
    setTimeout(() => clearInterval(intervalId), STATUS_LIFETIME_MS);
  } catch (error) {
    logError('StatusCommand', error, {
      userId: interaction.user?.id,
      interactionId: interaction.id,
    });

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(applyEmbedFallback(interaction.channel, {
        content: null,
        embeds: [createStatusEmbed({
          variant: 'error',
          title: 'Status Request Failed',
          description: 'An error occurred while fetching system status.',
        })],
        components: [],
      }));
      return;
    }

    await replyWithEmbed(interaction, {
      variant: 'error',
      title: 'Status Request Failed',
      description: 'An error occurred while fetching system status.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleBlacklistCommand(interaction) {
  if (!(await requireGuildAdmin(interaction))) {
    return;
  }

  const userId = interaction.options.getUser('user').id;
  const guildId = interaction.guild.id;

  if (addBlacklistedUser(guildId, userId)) {
    await persistStateChange();
    return replyWithEmbed(interaction, {
      variant: 'success',
      title: 'User Blocked',
      description: `<@${userId}> has been blocked.`,
      flags: undefined,
    });
  }

  return replyWithEmbed(interaction, {
    variant: 'warning',
    title: 'User Already Blocked',
    description: `<@${userId}> is already blocked.`,
    flags: undefined,
  });
}

async function handleWhitelistCommand(interaction) {
  if (!(await requireGuildAdmin(interaction))) {
    return;
  }

  const userId = interaction.options.getUser('user').id;
  const guildId = interaction.guild.id;

  if (removeBlacklistedUser(guildId, userId)) {
    await persistStateChange();
    return replyWithEmbed(interaction, {
      variant: 'success',
      title: 'User Unblocked',
      description: `<@${userId}> has been removed from the block list.`,
      flags: undefined,
    });
  }

  return replyWithEmbed(interaction, {
    variant: 'warning',
    title: 'User Not Found',
    description: `<@${userId}> is not in the block list.`,
    flags: undefined,
  });
}

async function handleWikiCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'buscar') {
    const termo = interaction.options.getString('termo');
    const entry = getWikiEntry(termo);
    if (!entry) {
      return replyWithEmbed(interaction, {
        variant: 'error',
        title: 'Página Não Encontrada',
        description: `Não encontramos nenhuma página com o título ou sinônimo **"${termo}"** na wiki.`,
      });
    }

    const aliasesText = entry.aliases && entry.aliases.length > 0
      ? `\n*Sinônimos:* ${entry.aliases.map(a => `\`${a}\``).join(', ')}`
      : '';

    return replyWithEmbed(interaction, {
      variant: 'primary',
      title: `📖 Wiki: ${entry.title}`,
      description: `**Categoria:** \`${entry.category}\`${aliasesText}\n\n${entry.content}`,
    });
  }

  if (subcommand === 'listar') {
    const categoria = interaction.options.getString('categoria');
    const entries = listWikiEntries(categoria);

    if (entries.length === 0) {
      return replyWithEmbed(interaction, {
        variant: 'info',
        title: 'Wiki Vazia',
        description: categoria
          ? `Nenhuma página cadastrada na categoria **${categoria}**.`
          : 'Nenhuma página cadastrada na wiki ainda.',
      });
    }

    const listText = entries.map(e => `- **${e.title}** (\`${e.category}\`)`).join('\n');
    return replyWithEmbed(interaction, {
      variant: 'primary',
      title: categoria ? `📚 Wiki: Páginas em "${categoria}"` : '📚 Wiki da Campanha',
      description: `Aqui estão as páginas registradas:\n\n${listText}`,
    });
  }

  if (subcommand === 'criar') {
    const titulo = interaction.options.getString('titulo');
    const conteudo = interaction.options.getString('conteudo');
    const categoria = interaction.options.getString('categoria');
    const aliases = interaction.options.getString('aliases') || '';

    const res = createWikiEntry(titulo, conteudo, categoria, aliases);
    if (!res.success) {
      return replyWithEmbed(interaction, {
        variant: 'error',
        title: 'Falha ao Criar Página',
        description: res.message,
      });
    }

    return replyWithEmbed(interaction, {
      variant: 'success',
      title: 'Página Criada!',
      description: `A página **"${res.entry.title}"** foi adicionada com sucesso à categoria \`${res.entry.category}\`.`,
    });
  }

  if (subcommand === 'editar') {
    const titulo = interaction.options.getString('titulo');
    const conteudo = interaction.options.getString('conteudo');
    const categoria = interaction.options.getString('categoria');
    const aliases = interaction.options.getString('aliases');

    const res = editWikiEntry(titulo, conteudo, categoria, aliases);
    if (!res.success) {
      return replyWithEmbed(interaction, {
        variant: 'error',
        title: 'Falha ao Editar Página',
        description: res.message,
      });
    }

    return replyWithEmbed(interaction, {
      variant: 'success',
      title: 'Página Atualizada!',
      description: `A página **"${res.entry.title}"** foi editada com sucesso.`,
    });
  }

  if (subcommand === 'deletar') {
    const titulo = interaction.options.getString('titulo');
    const res = deleteWikiEntry(titulo);

    if (!res.success) {
      return replyWithEmbed(interaction, {
        variant: 'error',
        title: 'Falha ao Deletar Página',
        description: res.message,
      });
    }

    return replyWithEmbed(interaction, {
      variant: 'success',
      title: 'Página Deletada',
      description: `A página **"${titulo}"** foi removida da wiki.`,
    });
  }
}

/** Routes a chat-input command interaction to its handler. */
export async function handleCommandInteraction(interaction) {
  try {
    if (!(await ensureInteractionNotBlacklisted(interaction))) {
      return;
    }

    const handlers = {
      unblock: handleWhitelistCommand,
      block: handleBlacklistCommand,
      clear_memory: handleClearMemoryCommand,
      settings: showSettings,
      server_settings: async (cmd) => {
        if (!(await requireGuildAdmin(cmd))) {
          return;
        }
        return showDashboard(cmd);
      },
      channel_settings: async (cmd) => {
        if (!(await requireGuildAdmin(cmd))) {
          return;
        }
        return showChannelDashboard(cmd);
      },
      status: handleStatusCommand,
      wiki: handleWikiCommand,
    };

    const handler = handlers[interaction.commandName];
    if (handler) {
      await handler(interaction);
      return;
    }

    logError('Command', `Unknown command: ${interaction.commandName}`, {
      commandName: interaction.commandName,
    });
  } catch (error) {
    logError('CommandHandler', error, {
      commandName: interaction.commandName,
      userId: interaction.user?.id,
    });
    await replyWithError(interaction, 'Command Error', 'An error occurred while running this command.');
  }
}

