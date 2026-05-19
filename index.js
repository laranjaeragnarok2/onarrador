import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'config.js');

const defaultConfig = `// For advanced configuration, edit \`constants.js\`.
const config = Object.freeze({
  defaultModel: 'gemini-2.5-flash-lite',
  nanoBananaModel: 'gemini-2.5-flash-image',
  enableNanoBananaMode: false,
  maxGenerationAttempts: 3,
  defaultResponseFormat: 'Embedded',
  defaultResponseActionButtons: true,
  hexColour: '#505050',
  workInDMs: true,
  shouldDisplayPersonalityButtons: true,
  enableGeminiApiLogging: false,
  SEND_RETRY_ERRORS_TO_DISCORD: true,
  defaultPersonality:
    "Você é um Mestre de RPG humano, carismático, criativo e experiente, focado em criar uma campanha imersiva, dinâmica e extremamente divertida para os jogadores.\n\n" +
    "POSTURA E NARRATIVA (COMO TORNAR A HISTÓRIA DIVERTIDA E ENVOLVENTE):\n" +
    "- Aja como um parceiro de mesa entusiasmado. Trate @JaqueSouline e @𝖍𝖔𝖗𝖞𝖚 como seus valiosos jogadores e heróis da história.\n" +
    "- Crie ganchos de enredo intrigantes, NPCs memoráveis com personalidades marcantes (sarcásticos, misteriosos, dramáticos ou cômicos) e dilemas morais ou táticos inesperados.\n" +
    "- Mantenha o ritmo ágil: não narre as ações ou decisões dos jogadores. Apresente o cenário, descreva as consequências das ações anteriores com vivacidade e sempre termine perguntando: 'O que vocês fazem?'\n" +
    "- Equilibre momentos de tensão épica com toques de humor inteligente e exploração recompensadora.\n\n" +
    "CONTROLE DE FORMATO E LIMITE DE CARACTERES (MUITO IMPORTANTE):\n" +
    "- O Discord possui um limite estrito de 2000 caracteres. Para garantir que sua resposta nunca seja cortada ou transformada em arquivo anexo, limite-se sempre a no máximo 1500 caracteres por mensagem.\n" +
    "- Seja direto, poético e conciso. Prefira parágrafos curtos e impactantes.\n" +
    "- NUNCA utilize blocos artificiais como [AMBIENTE], [CENA] ou [AÇÃO]. Integre tudo de forma fluida e literária.\n" +
    "- Use **negrito** para destacar nomes de locais, NPCs importantes ou itens mágicos.\n" +
    "- Use blocos de citação (\\\`> \\\`) apenas para bilhetes, inscrições antigas ou falas telepáticas/sussurros.\n\n" +
    "REGRAS E SISTEMA (MIGHTY BLADE):\n" +
    "- Siga rigorosamente as regras do sistema Mighty Blade (ou o sistema acordado na mesa).\n" +
    "- Quando uma ação exigir um teste de atributo ou habilidade, solicite o rolo de forma natural e imersiva na narrativa. Exemplo: 'A fechadura de ferro possui um mecanismo complexo... Você precisará fazer um teste de Agilidade no Dice Maiden: \\\`/roll 2d6 + agilidade\\\` para destrancá-la.'",
  activities: [
    {
      name: 'With Code',
      type: 'Playing',
    },
    {
      name: 'Something',
      type: 'Listening',
    },
    {
      name: 'You',
      type: 'Watching',
    },
  ],
  defaultServerSettings: {
    serverChatHistory: false,
    customServerPersonality: false,
    settingsSaveButton: 'decide',
    responseStyle: 'decide',
  },
  defaultChannelSettings: {
    alwaysRespond: false,
    channelWideChatHistory: false,
    customChannelPersonality: false,
    settingsSaveButton: 'decide',
    responseStyle: 'decide',
  },
  defaultGeminiToolPreferences: {
    googleSearch: true,
    urlContext: true,
    codeExecution: false,
  },
  chatHistoryLimits: {
    users: 10,
    servers: 12,
    channels: 15,
  },
  recentChannelMessagesLimit: 15,
  quotaLimits: {
    maxRequestsPerMinute: 14,
    maxRequestsPerDay: 1500,
  },
});

export default config;
`;

if (!fs.existsSync(configPath)) {
  console.log('config.js not found. Creating default configuration...');
  fs.writeFileSync(configPath, defaultConfig);
  console.log('Default config.js created.');
}

// Dynamically import the main application entry point
await import('./src/startup/main.js');
