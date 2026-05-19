import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../core/paths.js';

const WIKI_FILE_PATH = path.join(DATA_DIR, 'rpg_wiki.json');

// Memory cache to avoid synchronous disk reads on every message
let wikiCache = null;

export function loadWiki() {
  if (wikiCache !== null) {
    return wikiCache;
  }

  try {
    if (!fs.existsSync(WIKI_FILE_PATH)) {
      wikiCache = {};
      return wikiCache;
    }
    const data = fs.readFileSync(WIKI_FILE_PATH, 'utf-8');
    wikiCache = JSON.parse(data);
    return wikiCache;
  } catch (error) {
    console.error('[WikiService] Erro ao ler a wiki:', error);
    wikiCache = {};
    return wikiCache;
  }
}

export function saveWiki(wikiData) {
  try {
    wikiCache = wikiData;
    fs.writeFileSync(WIKI_FILE_PATH, JSON.stringify(wikiData, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[WikiService] Erro ao salvar a wiki:', error);
    return false;
  }
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
  const wiki = loadWiki();
  const normalizedTitle = title.trim();
  
  if (getWikiEntry(normalizedTitle)) {
    return { success: false, message: 'Uma página com este título já existe.' };
  }

  const aliases = aliasesStr
    ? aliasesStr.split(',').map(a => a.trim()).filter(Boolean)
    : [];

  wiki[normalizedTitle] = {
    title: normalizedTitle,
    content: content.trim(),
    category: category,
    aliases,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  saveWiki(wiki);
  return { success: true, entry: wiki[normalizedTitle] };
}

export function editWikiEntry(title, content, category = null, aliasesStr = null) {
  const wiki = loadWiki();
  const entry = getWikiEntry(title);

  if (!entry) {
    return { success: false, message: 'Página não encontrada.' };
  }

  // Update fields
  entry.content = content.trim();
  entry.updatedAt = new Date().toISOString();
  
  if (category) {
    entry.category = category;
  }
  
  if (aliasesStr !== null) {
    entry.aliases = aliasesStr
      ? aliasesStr.split(',').map(a => a.trim()).filter(Boolean)
      : [];
  }

  // Preserve the original key casing
  wiki[entry.title] = entry;
  
  saveWiki(wiki);
  return { success: true, entry };
}

export function deleteWikiEntry(title) {
  const wiki = loadWiki();
  const entry = getWikiEntry(title);

  if (!entry) {
    return { success: false, message: 'Página não encontrada.' };
  }

  delete wiki[entry.title];
  saveWiki(wiki);
  return { success: true };
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
      // Escape regex special characters
      const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Look for the term as a whole word/phrase
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
    return `### [Wiki] ${entry.title} (${entry.category})\n${entry.content}`;
  }).join('\n\n');
}
