// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'O Narrador',
  tagline: 'Wikipédia do Narrador - Mighty Blade RPG',
  favicon: 'icon.png',

  url: 'https://onarrador.vercel.app',
  baseUrl: '/',

  organizationName: 'laranjaeragnarok2',
  projectName: 'onarrador',

  markdown: {
    format: 'detect',
  },

  onBrokenLinks: 'ignore', // Prevent build crashes due to broken relative wiki links
  onBrokenMarkdownLinks: 'warn',

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/', // Serve docs-only mode at the root
        },
        blog: false, // Disable blog plugin
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'O Narrador',
        logo: {
          alt: 'O Narrador Logo',
          src: 'icon.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Wikipédia',
          },
          {
            href: 'https://github.com/laranjaeragnarok2/onarrador',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'light',
        copyright: `Copyright © ${new Date().getFullYear()} O Narrador. Baseado no sistema Mighty Blade RPG.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
