import fs from 'fs';
import path from 'path';
import { genAI } from '../core/runtime.js';
import { createWikiEntry, getWikiEntry } from '../services/wikiService.js';
import { DATA_DIR } from '../core/paths.js';

const CAMPAIGN_SUMMARIES_PATH = path.join(DATA_DIR, 'campaign_summaries.json');

/** Helper to clean raw control characters in JSON strings returned by LLMs */
function cleanRawJSON(str) {
  // Replace raw control characters (0x00-0x1F) except tab, carriage return, and newline
  // For raw newlines inside string values, we escape them to \n
  let cleaned = str;
  // Escape raw newlines that occur within double quotes (string literals)
  cleaned = cleaned.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, p1) => {
    // Replace raw newlines and other control characters inside the quoted string
    const escapedString = p1
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${escapedString}"`;
  });
  return cleaned;
}

async function compileWiki() {
  console.log('[CompileWiki] Iniciando compilação da enciclopédia a partir dos resumos existentes...');

  if (!fs.existsSync(CAMPAIGN_SUMMARIES_PATH)) {
    console.log('[CompileWiki] Nenhum arquivo de resumo de campanha encontrado em:', CAMPAIGN_SUMMARIES_PATH);
    return;
  }

  let summaries = {};
  try {
    const rawData = fs.readFileSync(CAMPAIGN_SUMMARIES_PATH, 'utf-8');
    summaries = JSON.parse(rawData);
  } catch (error) {
    console.error('[CompileWiki] Erro ao ler summaries:', error.message);
    return;
  }

  const keys = Object.keys(summaries);
  if (keys.length === 0) {
    console.log('[CompileWiki] Nenhum resumo de campanha encontrado dentro do arquivo.');
    return;
  }

  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-3.1-flash-lite'
  ];

  // Iterate over all channel summaries
  for (const historyId of keys) {
    const summaryText = summaries[historyId];
    console.log(`\n[CompileWiki] Processando resumo da campanha ID: ${historyId}...`);
    
    const prompt = `Você é um compilador de enciclopédia de RPG especialista no sistema Mighty Blade.
Abaixo está o resumo completo de uma campanha de RPG. Sua tarefa é extrair todas as entidades importantes mencionadas no resumo (como NPCs, locais/cidades visitados, itens importantes, regras/mecânicas específicas, e elementos de lore/facções/divindades) e estruturá-las para que possamos criar páginas individuais na nossa Wiki.

RESUMO DA CAMPANHA:
${summaryText}

Sua resposta deve ser estritamente no formato JSON abaixo:
{
  "entities": [
    {
      "title": "Nome da Entidade",
      "category": "NPC" ou "Local" ou "Item" ou "Lore" ou "Regra" ou "Outros",
      "content": "Descrição detalhada extraída do resumo (em markdown, sem repetir o título como H1. Se houver atributos, fichas de atributos ou habilidades conhecidas, monte em uma tabela markdown organizada).",
      "aliases": ["sinônimo1", "sinônimo2", ...]
    }
  ]
}

Por favor, garanta que:
1. "category" seja estritamente um destes: "NPC", "Local", "Item", "Lore", "Regra", "Outros".
2. Não invente informações; use apenas os fatos explícitos no resumo da campanha.
3. IMPORTANTE: Não coloque quebras de linha (Enter) diretas/reais dentro dos campos de texto das strings do JSON. Use a sequência de escape '\\n' para representar quebras de linha em textos com múltiplas linhas ou tabelas markdown.
`;

    let response = null;
    let success = false;
    let parsedData = null;

    for (const modelName of models) {
      try {
        console.log(`[CompileWiki] Tentando extrair entidades com o modelo: ${modelName}...`);
        response = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });
        
        const responseText = response.text || '';
        const cleanedText = cleanRawJSON(responseText);
        parsedData = JSON.parse(cleanedText);
        
        success = true;
        break; // Successfully parsed JSON
      } catch (err) {
        console.warn(`[CompileWiki] Falha ou erro de JSON com o modelo ${modelName}:`, err.message);
      }
    }

    if (!success || !parsedData) {
      console.error('[CompileWiki] ❌ Falha catastrófica: Todos os modelos de IA falharam ou geraram JSON inválido.');
      continue;
    }

    try {
      if (!parsedData.entities || !Array.isArray(parsedData.entities)) {
        console.error('[CompileWiki] Resposta da IA não contém uma lista válida de entidades.');
        continue;
      }

      console.log(`[CompileWiki] Extraídas ${parsedData.entities.length} entidades do resumo.`);

      for (const entity of parsedData.entities) {
        const { title, category, content, aliases } = entity;
        
        if (!title || !content || !category) continue;

        const existing = getWikiEntry(title);
        if (existing) {
          console.log(`[CompileWiki] ⚠️ Entidade "${title}" já existe. Ignorando para não sobrescrever.`);
          continue;
        }

        const aliasesStr = Array.isArray(aliases) ? aliases.join(',') : '';
        const result = createWikiEntry(title, content, category, aliasesStr);
        if (result.success) {
          console.log(`[CompileWiki] ✅ Criado wiki entry para: ${title} (${category})`);
        } else {
          console.error(`[CompileWiki] ❌ Falha ao criar wiki entry para: ${title}:`, result.message);
        }
      }

    } catch (err) {
      console.error('[CompileWiki] Erro ao salvar entidades extraídas:', err.message);
    }
  }

  console.log('\n[CompileWiki] Compilação concluída com sucesso!');
}

compileWiki().catch(err => {
  console.error('[CompileWiki] Erro fatal no script:', err);
});
