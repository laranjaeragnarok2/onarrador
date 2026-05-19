import fs from 'fs';
import path from 'path';

const WIKI_DIR = path.resolve(process.cwd(), 'wiki');

const CATEGORIES = [
  { dir: 'Regras', title: '📖 Regras & Guias', desc: 'Regras de combate, guias de classes, raças e mecânicas de Mighty Blade.' },
  { dir: 'NPCs', title: '👥 Personagens & NPCs', desc: 'Fichas de aliados, inimigos, criaturas e personagens dos jogadores.' },
  { dir: 'Locais', title: '🏰 Locais & Cenários', desc: 'Cidades, reinos, masmorras e pontos históricos descobertos.' },
  { dir: 'Itens', title: '⚔️ Itens & Equipamentos', desc: 'Armas, armaduras, tomos mágicos e itens de aventureiro.' },
  { dir: 'Lore', title: '📜 História & Lore', desc: 'Cronologias, deuses, lendas e mitos do cenário de campanha.' },
  { dir: 'Outros', title: '🌀 Outros Registros', desc: 'Diários de bordo, anotações diversas e resumos de sessões.' }
];

function generate() {
  console.log('[GenerateIndexes] Iniciando geração automática de índices...');

  for (const cat of CATEGORIES) {
    const dirPath = path.join(WIKI_DIR, cat.dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Read all files except index.md
    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.md') && file !== 'index.md');

    let mdContent = `---
layout: doc
---

# ${cat.title}

${cat.desc}

---

## 📄 Artigos Disponíveis (${files.length})

`;

    if (files.length === 0) {
      mdContent += `*Nenhum artigo disponível nesta categoria ainda.*`;
    } else {
      // List all pages with nice formatting
      for (const file of files) {
        const title = file.replace(/\.md$/, '').replace(/_/g, ' ');
        mdContent += `*   [${title}](./${file})\n`;
      }
    }

    const indexPath = path.join(dirPath, 'index.md');
    fs.writeFileSync(indexPath, mdContent, 'utf-8');
    console.log(`[GenerateIndexes] ✅ Índice gerado para ${cat.dir} (${files.length} páginas)`);
  }

  console.log('[GenerateIndexes] Todos os índices foram gerados com sucesso!');
}

generate();
