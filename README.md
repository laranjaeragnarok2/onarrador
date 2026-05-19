# 🔮 O Narrador — Mestre de RPG Autônomo com Gemini API

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-3C873A?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-14.25.1-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![Gemini API](https://img.shields.io/badge/Google-Gemini%20API-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

**O Narrador** é um bot avançado e autônomo para Discord projetado para atuar como Mestre/Narrador de campanhas de RPG de Mesa. Equipado com a inteligência do Google Gemini, o bot possui gerenciamento local de memória em "gavetas", extração automática de enciclopédia/wiki, e resiliência absoluta a limites de cota da API.

---

## 🌟 Principais Recursos

### 🧠 Gerenciamento de Memória em Gavetas
Evite custos de tokens desnecessários e esquecimento do mestre com nossa arquitetura de memória segmentada:
*   **Gaveta de Curto Prazo (RAM):** Mantém o contexto fluido das últimas 10 interações ativas do chat.
*   **Gaveta de Crônica (Timeline):** Compacta automaticamente os diálogos antigos em um resumo contínuo persistido localmente (`campaign_summaries.json`).
*   **Gaveta de Enciclopédia (Wiki Autônoma):** Conforme a aventura avança, o bot analisa os diálogos e **cria/atualiza páginas da Wiki de forma autônoma** sobre NPCs, locais e itens importantes (`rpg_wiki.json`). Quando os jogadores citam termos da wiki, o bot recupera essas informações e injeta-as dinamicamente no prompt do mestre.

### ⚡ Revezamento Dinâmico de Modelos (Fallback de 8 Camadas)
Bandeiras de erro `429 (Resource Exhausted)` ou `503` nunca mais interromperão suas sessões. O bot implementa um sistema de revezamento contínuo em tempo real que alterna entre os modelos caso as requisições atinjam a cota diária:
1. `gemini-2.5-flash-lite` (Principal)
2. `gemini-2.5-flash`
3. `gemini-2.0-flash`
4. `gemini-1.5-flash`
5. `gemini-3-flash-preview`
6. `gemini-3.1-flash-lite`
7. `gemini-2.5-pro`
8. `gemini-2.0-flash-lite`

### 🛡️ Quota Queue & Mutex
Lida com picos de tráfego no servidor enfileirando requisições e respeitando estritamente a taxa de requisições por minuto (RPM) e por dia (RPD) configurada, evitando banimentos temporários na API do Google AI Studio.

### 🖼️ Multimodalidade e Upload de Arquivos
O Narrador é capaz de ver e entender o que você envia no chat:
*   Analisa imagens de cenários ou tokens.
*   Lê fichas de personagens e mapas em formato PDF ou Office.
*   Ouve descrições enviadas por arquivos de áudio.

---

## 🛠️ Instalação e Configuração

### 1) Pré-requisitos
*   **Node.js 20+** instalado
*   Um Token de Bot do [Discord Developer Portal](https://discord.com/developers/applications)
*   Uma chave de API do [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2) Clonar e Instalar
```bash
git clone https://github.com/laranjaeragnarok2/onarrador.git
cd onarrador
npm install
```

### 3) Configuração do Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
DISCORD_BOT_TOKEN=seu_token_do_discord
GOOGLE_API_KEY=sua_chave_do_gemini
```

Ajuste as configurações básicas de cota, personalidade base ou modelo inicial no arquivo `config.js`.

### 4) Iniciar o Bot
```bash
npm start
```

---

## 🎮 Comandos do Bot

### Sistema de Wiki (`/wiki`)
Comando interativo para consulta e manipulação manual da enciclopédia da campanha:
*   `/wiki buscar termo:<termo>` — Busca uma página específica na wiki pelo título ou sinônimos (`aliases`).
*   `/wiki listar categoria:<NPC/Local/Item/Lore/Regra/Outros>` — Lista todas as páginas registradas.
*   `/wiki criar titulo:<titulo> conteudo:<conteudo> categoria:<categoria> aliases:[aliases]` — Registra uma página manualmente.
*   `/wiki editar titulo:<titulo> conteudo:<novo_conteudo> ...` — Edita uma página da wiki.
*   `/wiki deletar titulo:<titulo>` — Apaga uma página do banco.

### Comandos Gerais
*   `/settings` — Abre o painel interativo de configurações pessoais no Discord.
*   `/clear_memory` — Limpa o histórico de chat da sessão ativa.
*   `/status` — Exibe estatísticas de consumo de CPU/RAM em tempo real e monitoramento das cotas da API (RPM/RPD).
*   `/server_settings` — Painel de configurações gerais do servidor (Apenas Administradores).
*   `/channel_settings` — Painel de configuração de comportamento de canais (Apenas Administradores).

---

## 📂 Estrutura do Projeto

```text
onarrador/
├── data/              <- Gavetas locais de persistência (Histórico, Resumos e Wiki)
├── src/
│   ├── core/          <- Instanciação do runtime e caminhos compartilhados
│   ├── discord/       <- Registro dos construtores de Slash Commands
│   ├── handlers/      <- Roteadores de interações, botões, modais e mensagens
│   ├── services/      <- Orquestração do Gemini, gerenciador de cota e Wiki
│   ├── state/         <- Estado dos usuários, limites de cota e persistência
│   ├── ui/            <- Painéis de botões e seletores do Discord
│   └── utils/         <- Formatadores de texto, logs e tratamento de erros
├── index.js           <- Ponto de entrada do sistema
└── config.js          <- Configurações de modelo, personalidade e limites
```

---

## 📝 Licença
Este projeto é licenciado sob os termos da licença **MIT**. Veja o arquivo [LICENSE.md](LICENSE.md) para detalhes.
