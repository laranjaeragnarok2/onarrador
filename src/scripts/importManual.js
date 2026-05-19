import fs from 'fs';
import path from 'path';
import officeParser from 'officeparser';
import { genAI } from '../core/runtime.js';
import { createWikiEntry, getWikiEntry } from '../services/wikiService.js';

const MANUAIS_DIR = path.resolve(process.cwd(), 'manuais');

// Available models for extraction
const models = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
];

async function callGemini(prompt, responseMimeType = 'text/plain') {
  for (const modelName of models) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType,
          temperature: 0.1
        }
      });
      return response.text || '';
    } catch (err) {
      console.warn(`[Gemini Call] Falha com o modelo ${modelName}:`, err.message);
    }
  }
  throw new Error('Todos os modelos de IA falharam.');
}

/**
 * RAG Retriever: extracts context paragraphs from the manual text
 * around keywords to dramatically reduce token count per request.
 */
function getRelevantContext(rawText, keywords, contextWindow = 12000) {
  if (!keywords) {
    // If no keywords, fallback to first 25k characters
    return rawText.slice(0, 25000);
  }
  
  const keywordList = keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  const lowerText = rawText.toLowerCase();
  let matches = [];
  
  for (const kw of keywordList) {
    let idx = lowerText.indexOf(kw);
    while (idx !== -1) {
      matches.push(idx);
      idx = lowerText.indexOf(kw, idx + 1);
      if (matches.length > 30) break; // cap search matches to prevent bloat
    }
  }
  
  if (matches.length === 0) {
    return rawText.slice(0, 25000);
  }
  
  // Sort match locations
  matches.sort((a, b) => a - b);
  
  // Merge close or overlapping windows
  let blocks = [];
  let currentStart = Math.max(0, matches[0] - 1500);
  let currentEnd = Math.min(rawText.length, matches[0] + contextWindow);
  
  for (let i = 1; i < matches.length; i++) {
    const pos = matches[i];
    const nextStart = Math.max(0, pos - 1500);
    const nextEnd = Math.min(rawText.length, pos + contextWindow);
    
    if (nextStart <= currentEnd) {
      currentEnd = Math.max(currentEnd, nextEnd);
    } else {
      blocks.push(rawText.slice(currentStart, currentEnd));
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
    
    if (blocks.length >= 4) break; // Limit total blocks to keep context small
  }
  blocks.push(rawText.slice(currentStart, currentEnd));
  
  // Join all snippets
  return blocks.join('\n\n--- [TRECHO DO MANUAL] ---\n\n').slice(0, 50000);
}

async function run() {
  const args = process.argv.slice(2);
  let pdfName = args[0];

  if (!fs.existsSync(MANUAIS_DIR)) {
    console.error(`[ImportManual] Erro: A pasta "${MANUAIS_DIR}" não existe.`);
    return;
  }

  const pdfFiles = fs.readdirSync(MANUAIS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.error(`[ImportManual] Erro: Nenhum arquivo PDF encontrado na pasta "${MANUAIS_DIR}".`);
    return;
  }

  if (!pdfName) {
    pdfName = pdfFiles[0];
    console.log(`[ImportManual] Nenhum PDF especificado. Selecionando o primeiro disponível: "${pdfName}"`);
  } else {
    const matched = pdfFiles.find(f => f.toLowerCase().includes(pdfName.toLowerCase()));
    if (!matched) {
      console.error(`[ImportManual] Erro: Arquivo "${pdfName}" não encontrado na pasta manuais/. Disponíveis:`, pdfFiles);
      return;
    }
    pdfName = matched;
  }

  const pdfPath = path.join(MANUAIS_DIR, pdfName);
  console.log(`\n[ImportManual] 📄 Lendo PDF: "${pdfPath}"...`);
  
  let rawText = '';
  try {
    const ast = await officeParser.parseOffice(pdfPath);
    rawText = ast.toText();
    console.log(`[ImportManual] PDF extraído com sucesso! Total de caracteres: ${rawText.length}`);
  } catch (error) {
    console.error('[ImportManual] Erro ao extrair texto do PDF:', error.message);
    return;
  }

  if (!rawText.trim()) {
    console.error('[ImportManual] Erro: O PDF parece não conter texto extraível ou está vazio.');
    return;
  }

  // --- STEP 1: INDEXING ---
  console.log('\n--- ETAPA 1: MAPEANDO TÓPICOS E PÁGINAS ---');
  // Use first 200,000 characters for mapping to keep token counts small
  const indexPrompt = `Você é um mapeador de enciclopédias de RPG especialista em Mighty Blade.
Abaixo está uma amostra do texto extraído de um manual de RPG. Sua tarefa é analisar o texto e gerar uma lista dos tópicos principais que deveriam ter uma página exclusiva na nossa wiki de regras/lore.

Foque em extrair:
1. Classes de Personagem (ex: Guerreiro, Mago, Bardo, etc.).
2. Raças de Personagem (ex: Humano, Anão, Elfo, etc.).
3. Regras centrais do jogo (ex: Combate, Pontos de Mana, Atributos, Teste de Atributo, etc.).
4. Listas de Habilidades ou Magias importantes.
5. Itens e Equipamentos notáveis.
6. Conceitos importantes de Lore/Cenário descritos no texto.

TEXTO DO MANUAL:
${rawText.slice(0, 150000)}

Sua resposta deve ser estritamente no formato JSON abaixo:
{
  "topics": [
    {
      "title": "Nome do Tópico (ex: Guerreiro, Testes de Atributo, Combate)",
      "category": "Regra" ou "NPC" ou "Local" ou "Item" ou "Lore" ou "Outros",
      "searchKeywords": "Palavras-chave em minúsculas separadas por vírgula para buscar este tópico no texto (ex: 'guerreiro, classe guerreiro, habilidades de guerreiro')"
    }
  ]
}

Seja preciso. Gere no máximo 15 a 20 tópicos principais para mantermos a extração focada e não estourar os limites.
`;

  let topics = [];
  try {
    console.log('[ImportManual] Enviando texto ao Gemini para gerar índice de páginas...');
    const indexJson = await callGemini(indexPrompt, 'application/json');
    const parsed = JSON.parse(indexJson);
    topics = parsed.topics || [];
    console.log(`[ImportManual] Tópicos identificados para a wiki (${topics.length}):`);
    topics.forEach((t, i) => console.log(`  ${i + 1}. [${t.category}] ${t.title}`));
  } catch (err) {
    console.error('[ImportManual] Erro ao mapear tópicos com o Gemini:', err.message);
    return;
  }

  if (topics.length === 0) {
    console.log('[ImportManual] Nenhum tópico relevante identificado.');
    return;
  }

  // --- STEP 2: EXTRACTION ---
  console.log('\n--- ETAPA 2: EXTRAINDO CONTEÚDO DETALHADO ---');
  let createdCount = 0;

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`\n[${i + 1}/${topics.length}] Extraindo: "${topic.title}" (${topic.category})...`);

    const existing = getWikiEntry(topic.title);
    if (existing) {
      console.log(`  ⚠️ Tópico "${topic.title}" já existe na wiki. Pulando...`);
      continue;
    }

    // Get relevant chunks using our RAG retriever
    console.log(`  🔍 Buscando trechos relevantes sobre "${topic.title}" no manual...`);
    const relevantContext = getRelevantContext(rawText, topic.searchKeywords);
    console.log(`  📊 Contexto filtrado para ${relevantContext.length} caracteres.`);

    const extractionPrompt = `Você é um arquivista especialista no RPG Mighty Blade.
Abaixo estão trechos relevantes extraídos do manual de regras. Sua tarefa é extrair e detalhar todas as informações, regras, tabelas de atributos, requisitos de classe ou descrições específicas para o tópico: "${topic.title}" (${topic.category}).

Instruções de Formatação:
1. Escreva o conteúdo em Markdown claro e estruturado, ideal para uma enciclopédia/wiki.
2. Não repita o título como um cabeçalho H1 (não coloque "# ${topic.title}" no início).
3. Se for uma Classe, Raça, Item ou magia, crie uma tabela markdown no início que funcione como uma ficha de resumo (Infobox) lateral, com informações como: Requisitos, Atributos sugeridos, Pontos de Vida, Habilidades Iniciais, etc.
4. Explique as mecânicas, valores numéricos e descrições textuais associadas de forma fiel ao manual.

TEXTOS EXTRAÍDOS DO MANUAL:
${relevantContext}
`;

    try {
      const markdownContent = await callGemini(extractionPrompt, 'text/plain');
      
      if (!markdownContent || markdownContent.trim().length < 50) {
        console.warn(`  ⚠️ Conteúdo extraído para "${topic.title}" parece estar vazio ou muito curto. Pulando.`);
        continue;
      }

      // Automatically generate aliases based on title
      const aliases = [
        topic.title.toLowerCase(),
        topic.title.replace(/ /g, '_').toLowerCase()
      ];

      const result = createWikiEntry(topic.title, markdownContent, topic.category, aliases.join(','));
      if (result.success) {
        console.log(`  ✅ Criado com sucesso: "${topic.title}"`);
        createdCount++;
      } else {
        console.error(`  ❌ Erro ao salvar: ${result.message}`);
      }

      // Wait 3 seconds to prevent hitting RPM limit on free tier
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`  ❌ Falha ao processar "${topic.title}":`, err.message);
    }
  }

  console.log(`\n[ImportManual] 🎉 Processo concluído! ${createdCount} novas páginas foram inseridas na Wiki.`);
}

run().catch(err => {
  console.error('[ImportManual] Erro catastrófico:', err);
});
