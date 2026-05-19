/**
 * Streaming response service.
 * Handles streaming Gemini API responses, managing the stop-generation button,
 * debounced message updates, large-response overflow, and post-stream finalization.
 */

import { logServiceError } from '../utils/errorHandler.js';
import { genAI } from '../core/runtime.js';
import {
  chatHistoryLock,
  saveStateToFile,
  shouldShowActionButtons,
  updateChatHistory,
  state,
  markHistoryDirty,
  saveStateToFileImmediate,
  getCampaignSummary,
  setCampaignSummary,
} from '../state/botState.js';
import {
  EMBED_RESPONSE_LIMIT,
  GENERATION_ATTEMPT_TIMEOUT_MS,
  MAX_GENERATION_ATTEMPTS,
  MESSAGE_TYPING_TIMEOUT_MS,
  PLAIN_RESPONSE_LIMIT,
  SEND_RETRY_ERRORS_TO_DISCORD,
  STREAM_UPDATE_DEBOUNCE_MS,
  MODEL,
} from '../constants.js';
import { getResponsePreference, resolveHistoryId } from './conversationContext.js';
import {
  assignFileNames,
  cleanSandboxLinks,
  extractSandboxFilenames,
  getFileExtension,
  sendCodeExecutionFiles,
} from './codeExecutionService.js';
import {
  addDeleteButton,
  addSettingsButton,
  clearMessageActionRows,
  removeStopGeneratingButton,
} from '../ui/messageActions.js';
import { applyEmbedFallback, createStatusEmbed } from '../utils/discord.js';
import {
  buildRetryErrorEmbed,
  formatGeminiErrorForConsole,
} from '../utils/errorFormatter.js';
import { toDeleteHistoryRef } from '../utils/historyRef.js';
import { getWikiEntry, createWikiEntry, editWikiEntry } from './wikiService.js';
import {
  createAttemptTimeout,
  getRetryDelayMs,
  isAbortError,
  sleep,
} from './streaming/retryController.js';
import {
  createStreamAccumulator,
  processStreamChunk,
  resetStreamAccumulatorForAttempt,
} from './streaming/chunkProcessor.js';
import { buildResponseEmbed } from './streaming/renderer.js';
import {
  createCollector,
  ensureInitialBotMessage,
} from './streaming/controls.js';
import { handleLargeOrFinalResponse } from './streaming/delivery.js';

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function logStreamError(operation, error, metadata = {}) {
  logServiceError('StreamingService', error, { operation, ...metadata });
}


// ---------------------------------------------------------------------------
// Conversation persistence
// ---------------------------------------------------------------------------

async function manageCampaignSummary(historyId) {
  try {
    const historyMap = state.chatHistories[historyId];
    if (!historyMap) return;

    const entries = Object.entries(historyMap);
    const MAX_WINDOW_TURNS = 10;
    const BUFFER_TURNS = 4;

    if (entries.length >= MAX_WINDOW_TURNS + BUFFER_TURNS) {
      console.log(`[Memory] Compactando histórico para ${historyId}. Turnos atuais: ${entries.length}`);
      const oldestEntries = entries.slice(0, BUFFER_TURNS);
      let dialogueToSummarize = '';

      for (const [msgId, messages] of oldestEntries) {
        for (const msg of messages) {
          const roleName = msg.role === 'assistant' ? 'Mestre (IA)' : 'Jogador';
          const text = Array.isArray(msg.content)
            ? msg.content.map((p) => p.text || '').join(' ')
            : '';
          dialogueToSummarize += `${roleName}: ${text}\n\n`;
        }
      }

      const currentSummary = getCampaignSummary(historyId) || 'Nenhum resumo anterior.';
      const prompt = `Você é um assistente de Mestre de RPG responsável por manter a memória de longo prazo (resumo) e a enciclopédia/wiki da campanha.
Abaixo está o resumo atual da campanha, seguido pelos diálogos mais recentes que precisam ser integrados à memória.

RESUMO ATUAL:
${currentSummary}

NOVOS ACONTECIMENTOS (Diálogos):
${dialogueToSummarize}

Sua tarefa:
Analise os diálogos novos e gere um objeto JSON contendo:
1. "summary": Um resumo atualizado da campanha até o momento, conciso e detalhado, mantendo nomes de personagens, locais, itens, mistérios e o andamento geral da aventura.
2. "wiki_updates": Uma lista de entidades importantes (NPCs, itens mágicos/relevantes, locais novos visitados ou termos históricos importantes) que foram introduzidas ou sofreram mudanças de status nestes novos diálogos. Cada entidade deve ter:
   - "title": Nome próprio da entidade (ex: "Ferreiro Valdir", "Vila Nova").
   - "category": Categoria da wiki (escolha estritamente entre: "NPC", "Local", "Item", "Lore", "Regra", "Outros").
   - "content": A descrição do que aconteceu ou quem é esta entidade com base nos novos diálogos. Se a entidade já era descrita no resumo atual ou se você sabe que ela já existe, adicione novos fatos ou atualize a descrição dela.
   - "aliases": Uma lista de termos/sinônimos em minúsculas que ativem essa página (ex: ["valdir", "ferreiro"]).

Sua resposta deve ser estritamente no formato JSON abaixo:
{
  "summary": "...",
  "wiki_updates": [
    {
      "title": "...",
      "category": "...",
      "content": "...",
      "aliases": [...]
    }
  ]
}`;

      const summaryModels = [
        MODEL,
        'gemini-2.5-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
      ];

      let response = null;
      for (const mName of summaryModels) {
        try {
          response = await genAI.models.generateContent({
            model: mName,
            config: {
              temperature: 0.3,
              responseMimeType: 'application/json',
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          if (response && response.text) break;
        } catch (err) {
          console.warn(`[Memory Fallback] Modelo ${mName} falhou por cota na compactação. Tentando próximo...`);
        }
      }

      if (response && response.text) {
        try {
          const result = JSON.parse(response.text.trim());
          const newSummary = result.summary || '';
          const wikiUpdates = result.wiki_updates || [];

          if (newSummary) {
            setCampaignSummary(historyId, newSummary);
          }

          // Processa as atualizações automáticas de wiki
          for (const update of wikiUpdates) {
            if (update.title && update.content && update.category) {
              const existing = getWikiEntry(update.title);
              if (update.content.trim().length > 10) {
                if (existing) {
                  editWikiEntry(update.title, update.content, update.category, (update.aliases || []).join(','));
                  console.log(`[Memory Wiki] Atualizado automaticamente: "${update.title}"`);
                } else {
                  createWikiEntry(update.title, update.content, update.category, (update.aliases || []).join(','));
                  console.log(`[Memory Wiki] Criado automaticamente: "${update.title}"`);
                }
              }
            }
          }

          for (const [msgId] of oldestEntries) {
            delete state.chatHistories[historyId][msgId];
          }
          markHistoryDirty(historyId);
          await saveStateToFileImmediate();
          console.log(`[Memory] Resumo atualizado e wiki populada automaticamente para ${historyId}.`);
        } catch (parseError) {
          console.error('[Memory] Falha ao processar JSON de resumo/wiki:', parseError, response.text);
          // Fallback para texto plano se não for JSON válido
          const cleanText = response.text.trim();
          if (cleanText) {
            setCampaignSummary(historyId, cleanText);
            for (const [msgId] of oldestEntries) {
              delete state.chatHistories[historyId][msgId];
            }
            markHistoryDirty(historyId);
            await saveStateToFileImmediate();
            console.log(`[Memory Fallback] Salvo resumo simples em texto plano para ${historyId}.`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[Memory] Erro ao gerenciar resumo da campanha para ${historyId}:`, error);
  }
}

async function persistConversation(historyId, messageId, parts, assistantParts) {
  await chatHistoryLock.runExclusive(async () => {
    updateChatHistory(historyId, [
      { role: 'user', content: parts },
      { role: 'assistant', content: assistantParts },
    ], messageId);
    await saveStateToFile();

    await manageCampaignSummary(historyId);
  });
}

// ---------------------------------------------------------------------------
// Main streaming entry point
// ---------------------------------------------------------------------------

/**
 * Streams a model response to Discord, handling retries, stop-generation,
 * large-response overflow, and post-response actions.
 *
 * @param {Object} options
 * @param {import('discord.js').Message|null} options.initialBotMessage - Existing bot message to reuse, or null.
 * @param {Object} options.chat - The Gemini chat session.
 * @param {Array} options.parts - The prompt parts to send.
 * @param {import('discord.js').Message} options.originalMessage - The user's original message.
 * @param {string[]} [options.extraMessageIds] - Optional related message IDs to bind to parent delete controls.
 */
export async function streamModelResponse({
  initialBotMessage,
  chat,
  parts,
  originalMessage,
  extraMessageIds = [],
}) {
  const historyId = resolveHistoryId(originalMessage);
  const deleteHistoryRef = toDeleteHistoryRef(historyId, originalMessage.author.id);
  const responsePreference = getResponsePreference(originalMessage);
  const maxCharacterLimit = responsePreference === 'Embedded' ? EMBED_RESPONSE_LIMIT : PLAIN_RESPONSE_LIMIT;
  let botMessage = await ensureInitialBotMessage(initialBotMessage, originalMessage);
  let finalized = false;
  let bufferedText = '';
  let updateTimeout = null;
  let isLargeResponse = false;
  let activeAbortController = null;

  const clearPendingUpdate = () => {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  };

  const stopActiveGeneration = async () => {
    clearPendingUpdate();

    if (activeAbortController && !activeAbortController.signal.aborted) {
      activeAbortController.abort();
    }

    if (botMessage) {
      await removeStopGeneratingButton(botMessage);
    }
  };

  // Mutable collector placeholder
  let generationCollector = null;
  const wasStopped = () => activeAbortController?.signal.aborted || finalized;

  // Shared mutable accumulator updated by processStreamChunk
  const accumulator = createStreamAccumulator();

  const flushBufferedText = async () => {
    if (wasStopped() || finalized || isLargeResponse) return;

    if (!bufferedText.trim()) {
      return;
    }

    if (!botMessage) {
       botMessage = await originalMessage.reply(applyEmbedFallback(originalMessage.channel, {
         content: '✨ *O Mestre está pensando...*',
       }));
       
       // Create collector only after message is sent
       const { collector } = createCollector(botMessage, originalMessage, stopActiveGeneration);
       generationCollector = collector;
    }

    if (responsePreference === 'Embedded') {
      buildResponseEmbed(botMessage, bufferedText, originalMessage, accumulator.groundingMetadata, accumulator.urlContextMetadata).catch((error) => {
        logStreamError('flushBufferedTextEmbed', error, { messageId: botMessage.id });
      });
    } else {
      botMessage.edit({ content: bufferedText, embeds: [] }).catch((error) => {
        logStreamError('flushBufferedTextPlain', error, { messageId: botMessage.id });
      });
    }

    clearPendingUpdate();
  };

  const finalizeResponse = async (finalResponseText, responseWasLarge) => {
    const trimmedFinalResponse = finalResponseText.trim();
    const hasResponseText = trimmedFinalResponse.length > 0;
    const normalizedFinalResponse = hasResponseText
      ? trimmedFinalResponse
      : '[Empty response]';

    clearPendingUpdate();

    if (!botMessage) {
      botMessage = await originalMessage.reply(applyEmbedFallback(originalMessage.channel, {
        content: responseWasLarge ? '...' : normalizedFinalResponse,
      }));
    }

    if (!responseWasLarge) {
      if (responsePreference === 'Embedded') {
        await buildResponseEmbed(botMessage, normalizedFinalResponse, originalMessage, accumulator.groundingMetadata, accumulator.urlContextMetadata);
      } else {
        await botMessage.edit({ content: normalizedFinalResponse, embeds: [] }).catch((error) => {
          logStreamError('finalPlainEdit', error, { messageId: botMessage.id });
        });
      }
    }

    let filesMessage = null;
    if (accumulator.inlineDataFiles.length > 0) {
      filesMessage = await sendCodeExecutionFiles(accumulator.inlineDataFiles, originalMessage, deleteHistoryRef);
    }

    const linkedMessageIds = [
      filesMessage?.id,
      ...extraMessageIds,
    ].filter(Boolean);

    botMessage = await handleLargeOrFinalResponse(
      botMessage,
      originalMessage,
      normalizedFinalResponse,
      responseWasLarge,
      deleteHistoryRef,
      linkedMessageIds,
    );

    if (hasResponseText) {
      const assistantPartsForHistory = accumulator.rawAssistantParts.length > 0
        ? accumulator.rawAssistantParts
        : [{ text: normalizedFinalResponse }];
      await persistConversation(historyId, botMessage.id, parts, assistantPartsForHistory);
    }

    finalized = true;
    activeAbortController = null;
    generationCollector?.stop('completed');
  };

  try {
    const fallbackModels = [
      chat.model,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.0-flash-lite',
    ];
    let currentModelIndex = 0;
    let attempts = fallbackModels.length; // 8 attempts total

    while (attempts > 0 && !wasStopped()) {
      let attemptTimeout = null;

      try {
        activeAbortController = new AbortController();
        attemptTimeout = createAttemptTimeout(activeAbortController, GENERATION_ATTEMPT_TIMEOUT_MS);

        const stream = await chat.sendMessageStream({
          message: parts,
          config: {
            ...(chat.config ?? {}),
            abortSignal: activeAbortController.signal,
          },
        });
        let finalResponse = '';
        isLargeResponse = false;
        resetStreamAccumulatorForAttempt(accumulator);

        for await (const chunk of stream) {
          if (wasStopped()) {
            break;
          }

          const chunkText = processStreamChunk(chunk, accumulator);

          if (chunkText) {
            finalResponse += chunkText;
            bufferedText += chunkText;
          }

          if (finalResponse.length > maxCharacterLimit) {
            if (!isLargeResponse) {
              isLargeResponse = true;
              clearPendingUpdate();
              botMessage.edit(applyEmbedFallback(originalMessage.channel, {
                embeds: [createStatusEmbed({
                  variant: 'warning',
                  title: 'Response Overflow',
                  description: 'This response is too long for a Discord message and will be delivered as an attached file.',
                })],
              })).catch((error) => {
                logStreamError('overflowWarningEdit', error, { messageId: botMessage.id });
              });
            }
          } else if (!updateTimeout) {
            updateTimeout = setTimeout(flushBufferedText, STREAM_UPDATE_DEBOUNCE_MS);
          }
        }

        // --- Post-stream processing ---

        // Determine file extensions from generated files and assign sandbox names
        const activeExtensions = accumulator.inlineDataFiles
          .map((f) => getFileExtension(f.mimeType).replace(/^\./, '').split('+')[0])
          .filter((ext) => ext && /^[a-z0-9]+$/i.test(ext));

        const sandboxFilenames = extractSandboxFilenames(finalResponse, activeExtensions);
        const actualNames = assignFileNames(accumulator.inlineDataFiles, sandboxFilenames);

        finalResponse = cleanSandboxLinks(finalResponse, actualNames);
        await finalizeResponse(finalResponse, isLargeResponse);
        attemptTimeout.clear();
        return;
      } catch (error) {
        attemptTimeout?.clear();
        const attemptTimedOut = attemptTimeout?.wasTimedOut?.() || false;
        const wasAborted = wasStopped() || activeAbortController?.signal.aborted;
        if (wasAborted && !attemptTimedOut && (isAbortError(error) || activeAbortController?.signal.aborted)) {
          await finalizeResponse(bufferedText, bufferedText.length > maxCharacterLimit);
          return;
        }

        activeAbortController = null;

        if (error?.status === 429 || error?.status === 503 || error?.message?.includes('429') || error?.message?.includes('503')) {
          currentModelIndex = (currentModelIndex + 1) % fallbackModels.length;
          chat.model = fallbackModels[currentModelIndex];
          console.log(`[Model Fallback] Cota/Sobrecarga detectada. Alternando chat.model para: ${chat.model}`);
        }

        attempts -= 1;
        console.error(formatGeminiErrorForConsole(error, {
          attemptNumber: fallbackModels.length - attempts,
          totalAttempts: fallbackModels.length,
          remainingAttempts: attempts,
          userId: originalMessage.author.id,
          channelId: originalMessage.channel?.id,
          historyId,
        }), error);

        if (attempts <= 0 || wasStopped()) {
          if (!wasStopped()) {
            const embed = SEND_RETRY_ERRORS_TO_DISCORD
              ? buildRetryErrorEmbed(error, { isFinal: true })
              : createStatusEmbed({
                  variant: 'error',
                  title: 'Bot Overloaded',
                  description: 'The bot is currently overloaded or unavailable. Please try again shortly.',
                });

            const errorMessage = await originalMessage.channel.send(applyEmbedFallback(originalMessage.channel, {
              content: `<@${originalMessage.author.id}>`,
              embeds: [embed],
            }));

            const linkedMessageIds = [
              botMessage?.id,
              ...extraMessageIds,
            ].filter(Boolean);

            if (shouldShowActionButtons(originalMessage.guild?.id, originalMessage.author.id, originalMessage.channelId)) {
              let updatedErrorMessage = await addSettingsButton(errorMessage);
              updatedErrorMessage = await addDeleteButton(
                updatedErrorMessage,
                [updatedErrorMessage.id, ...linkedMessageIds].join(','),
                deleteHistoryRef,
              );

              if (botMessage) {
                botMessage = await clearMessageActionRows(botMessage);
                botMessage = await addSettingsButton(botMessage);
                botMessage = await addDeleteButton(botMessage, [botMessage.id, updatedErrorMessage.id, ...extraMessageIds].join(','), deleteHistoryRef);
              }
            } else if (botMessage) {
              botMessage = await clearMessageActionRows(botMessage);
            }
            finalized = true;
          }

          generationCollector?.stop();
          return;
        }

        if (SEND_RETRY_ERRORS_TO_DISCORD) {
          const retryMessage = await originalMessage.channel.send(applyEmbedFallback(originalMessage.channel, {
            content: `<@${originalMessage.author.id}>`,
            embeds: [buildRetryErrorEmbed(error, { isFinal: false })],
          }));

          setTimeout(() => {
            retryMessage.delete().catch((deleteError) => {
              logStreamError('deleteRetryMessage', deleteError, { messageId: retryMessage.id });
            });
          }, 5_000);
        }

        const attemptNumber = MAX_GENERATION_ATTEMPTS - attempts;
        const retryDelayMs = getRetryDelayMs(error, attemptNumber);

        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
      }
    }
  } finally {
    if (!finalized && !wasStopped()) {
      clearPendingUpdate();
    }
    if (finalized && botMessage) {
      await removeStopGeneratingButton(botMessage);
    }
  }
}
