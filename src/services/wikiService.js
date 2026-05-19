import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { DATA_DIR } from '../core/paths.js';

const WIKI_DIR = path.resolve(process.cwd(), 'wiki');

// Category subdirectories mapping
const CATEGORY_DIRS = {
  'NPC': 'NPCs',
  'Local': 'Locais',
  'Item': 'Itens',
  'Lore': 'Lore',
  'Regra': 'Regras',
  'Outros': 'Outros'
};

// Memory cache to avoid synchronous disk reads on every message
let wikiCache = null;
let gitSyncTimeout = null;

/** Trigger debounced git add/commit/push to publish changes to Vercel via GitHub */
function triggerGitSync() {
  if (gitSyncTimeout) {
    clearTimeout(gitSyncTimeout);
  }
  
  // Debounce for 5 seconds to batch multiple operations (e.g. from campaign summarization)
  gitSyncTimeout = setTimeout(() => {
    console.log('[Wiki Git Sync] Iniciando commit e push automático dos arquivos da Wiki...');
    exec('git add wiki/ && git commit -m "docs: wiki auto-update from campaign" && git push', (error, stdout, stderr) => {
      if (error) {
        console.error('[Wiki Git Sync] Erro no push automático (provavelmente sem alterações ou sem credenciais):', error.message);
        return;
      }
      console.log('[Wiki Git Sync] Wiki sincronizada com sucesso no GitHub:\n', stdout);
    });
  }, 5000);
}

/** Parses frontmatter and body from a markdown file */
function parseMarkdownFile(filePath) {
  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const parts = rawContent.split('---');
    
    let category = 'Outros';
    let aliases = [];
    let createdAt = new Date().toISOString();
    let updatedAt = new Date().toISOString();
    let title = path.basename(filePath, '.md').replace(/_/g, ' ');
    let content = rawContent.trim();

    if (parts.length >= 3) {
      const frontmatter = parts[1];
      content = parts.slice(2).join('---').trim();

      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*(\w+)\s*:\s*(.*)/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim();
          if (key === 'category') {
            category = val;
          } else if (key === 'aliases') {
            if (val.startsWith('[') && val.endsWith(']')) {
              aliases = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            } else {
              aliases = val.split(',').map(s => s.trim()).filter(Boolean);
            }
          } else if (key === 'createdAt') {
            createdAt = val;
          } else if (key === 'updatedAt') {
            updatedAt = val;
          }
        }
      }
    }

    // Parse title from first header # if present, otherwise use clean filename
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    return {
      title,
      content,
      category,
      aliases,
      createdAt,
      updatedAt,
      filePath
    };
  } catch (error) {
    console.error(`[WikiService] Erro ao analisar arquivo markdown ${filePath}:`, error);
    return null;
  }
}

/** Formats title, metadata and content into frontmatter markdown */
function formatMarkdownFile(title, content, category, aliases, createdAt, updatedAt) {
  const cleanContent = content.trim().startsWith('#') 
    ? content.trim() 
    : `# ${title}\n\n${content.trim()}`;
    
  return `---
category: ${category}
aliases: [${(aliases || []).join(', ')}]
createdAt: ${createdAt}
updatedAt: ${updatedAt}
---
${cleanContent}
`;
}

export function loadWiki() {
  if (wikiCache !== null) {
    return wikiCache;
  }

  wikiCache = {};
  try {
    if (!fs.existsSync(WIKI_DIR)) {
      fs.mkdirSync(WIKI_DIR, { recursive: true });
    }

    // Ensure category folders exist
    for (const folder of Object.values(CATEGORY_DIRS)) {
      const folderPath = path.join(WIKI_DIR, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    }

    // Run Migration from single JSON file if it exists
    const OLD_JSON_PATH = path.join(DATA_DIR, 'rpg_wiki.json');
    if (fs.existsSync(OLD_JSON_PATH)) {
      try {
        console.log('[WikiService] Detectado rpg_wiki.json antigo. Iniciando migração para pasta wiki/...');
        const oldData = JSON.parse(fs.readFileSync(OLD_JSON_PATH, 'utf-8'));
        for (const [title, entry] of Object.entries(oldData)) {
          const category = entry.category || 'Outros';
          const folderName = CATEGORY_DIRS[category] || 'Outros';
          const safeFilename = title.replace(/[\/\\?%*:|"<>\[\] ]/g, '_') + '.md';
          const filePath = path.join(WIKI_DIR, folderName, safeFilename);
          
          const fileContent = formatMarkdownFile(
            title,
            entry.content,
            category,
            entry.aliases || [],
            entry.createdAt || new Date().toISOString(),
            entry.updatedAt || new Date().toISOString()
          );
          fs.writeFileSync(filePath, fileContent, 'utf-8');
        }
        fs.renameSync(OLD_JSON_PATH, OLD_JSON_PATH + '.migrated');
        console.log('[WikiService] Migração concluída com sucesso!');
      } catch (err) {
        console.error('[WikiService] Erro ao migrar wiki JSON:', err);
      }
    }

    // Scan markdown files inside each category folder
    for (const folder of Object.values(CATEGORY_DIRS)) {
      const folderPath = path.join(WIKI_DIR, folder);
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        if (file.endsWith('.md') && file !== 'index.md') {
          const filePath = path.join(folderPath, file);
          const entry = parseMarkdownFile(filePath);
          if (entry) {
            wikiCache[entry.title] = entry;
          }
        }
      }
    }
  } catch (error) {
    console.error('[WikiService] Erro ao carregar wiki da pasta:', error);
  }

  return wikiCache;
}

export function getWikiEntry(title) {
  const wiki = loadWiki();
  const normalizedTitle = title.trim().toLowerCase();
  for (const key of Object.keys(wiki)) {
    if (key.toLowerCase() === normalizedTitle) {
      return wiki[key];
    }
  }
  return null;
}

export function createWikiEntry(title, content, category, aliasesStr = '') {
  loadWiki();
  const normalizedTitle = title.trim();
  
  if (getWikiEntry(normalizedTitle)) {
    return { success: false, message: 'Uma página com este título já existe.' };
  }

  const normalizedCategory = CATEGORY_DIRS[category] ? category : 'Outros';
  const folderName = CATEGORY_DIRS[normalizedCategory];
  const safeFilename = normalizedTitle.replace(/[\/\\?%*:|"<>\[\] ]/g, '_') + '.md';
  const filePath = path.join(WIKI_DIR, folderName, safeFilename);

  const aliases = aliasesStr
    ? aliasesStr.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
    : [];

  const now = new Date().toISOString();
  const fileContent = formatMarkdownFile(normalizedTitle, content, normalizedCategory, aliases, now, now);

  try {
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    const newEntry = {
      title: normalizedTitle,
      content: content.trim(),
      category: normalizedCategory,
      aliases,
      createdAt: now,
      updatedAt: now,
      filePath
    };
    wikiCache[normalizedTitle] = newEntry;

    triggerGitSync();
    return { success: true, entry: newEntry };
  } catch (error) {
    console.error('[WikiService] Erro ao criar arquivo da wiki:', error);
    return { success: false, message: 'Erro ao salvar o arquivo no disco.' };
  }
}

export function editWikiEntry(title, content, category = null, aliasesStr = null) {
  loadWiki();
  const entry = getWikiEntry(title);

  if (!entry) {
    return { success: false, message: 'Página não encontrada.' };
  }

  const oldCategory = entry.category;
  if (category && category !== oldCategory) {
    try {
      if (fs.existsSync(entry.filePath)) {
        fs.unlinkSync(entry.filePath);
      }
    } catch (e) {
      console.error('[WikiService] Erro ao remover arquivo antigo após mudar categoria:', e);
    }
    entry.category = category;
    const folderName = CATEGORY_DIRS[category] || 'Outros';
    const safeFilename = entry.title.replace(/[\/\\?%*:|"<>\[\] ]/g, '_') + '.md';
    entry.filePath = path.join(WIKI_DIR, folderName, safeFilename);
  }

  entry.content = content.trim();
  entry.updatedAt = new Date().toISOString();
  
  if (aliasesStr !== null) {
    entry.aliases = aliasesStr
      ? aliasesStr.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
      : [];
  }

  const fileContent = formatMarkdownFile(
    entry.title,
    entry.content,
    entry.category,
    entry.aliases,
    entry.createdAt,
    entry.updatedAt
  );

  try {
    fs.writeFileSync(entry.filePath, fileContent, 'utf-8');
    wikiCache[entry.title] = entry;
    
    triggerGitSync();
    return { success: true, entry };
  } catch (error) {
    console.error('[WikiService] Erro ao editar arquivo da wiki:', error);
    return { success: false, message: 'Erro ao salvar o arquivo no disco.' };
  }
}

export function deleteWikiEntry(title) {
  loadWiki();
  const entry = getWikiEntry(title);

  if (!entry) {
    return { success: false, message: 'Página não encontrada.' };
  }

  try {
    if (fs.existsSync(entry.filePath)) {
      fs.unlinkSync(entry.filePath);
    }
    delete wikiCache[entry.title];
    
    triggerGitSync();
    return { success: true };
  } catch (error) {
    console.error('[WikiService] Erro ao deletar arquivo da wiki:', error);
    return { success: false, message: 'Erro ao remover o arquivo do disco.' };
  }
}

export function listWikiEntries(category = null) {
  const wiki = loadWiki();
  const entries = Object.values(wiki);
  if (category) {
    const normalizedCategory = category.trim().toLowerCase();
    return entries.filter(e => e.category.toLowerCase() === normalizedCategory);
  }
  return entries;
}

export function getRelevantWikiContext(messageText) {
  if (!messageText) return '';
  const wiki = loadWiki();
  const matchedEntries = [];
  const normalizedText = messageText.toLowerCase();

  for (const [title, entry] of Object.entries(wiki)) {
    const terms = [
      title.toLowerCase(),
      ...(entry.aliases || []).map(a => a.trim().toLowerCase())
    ].filter(Boolean);
    
    let matched = false;
    for (const term of terms) {
      const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
      if (regex.test(normalizedText)) {
        matched = true;
        break;
      }
    }

    if (matched) {
      matchedEntries.push(entry);
    }
  }

  if (matchedEntries.length === 0) return '';

  return matchedEntries.map(entry => {
    // Strip potential markdown headers if we want, but LLMs handle clean markdown beautifully
    return `### [Wiki] ${entry.title} (${entry.category})\n${entry.content}`;
  }).join('\n\n');
}
