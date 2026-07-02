import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// LootLoop documentation wiki. Docs-only mode (routeBasePath: '/') — there is no
// blog and the docs tree is the site root. Deployed to GitHub Pages at
// https://samipdesai.github.io/lootloop/ by .github/workflows/deploy-docs.yml.
const config: Config = {
  title: 'LootLoop Docs',
  tagline: 'Family chore & reward app — system design & feature wiki',
  favicon: 'img/logo.svg',

  url: 'https://samipdesai.github.io',
  baseUrl: '/lootloop/',

  organizationName: 'samipdesai',
  projectName: 'lootloop',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  themes: [
    '@docusaurus/theme-mermaid',
    [
      // Offline/local search — no external service (Algolia) required.
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          // Point "Edit this page" at the source markdown on the feature branch's
          // eventual home (main). Adjust if the default branch changes.
          editUrl: 'https://github.com/samipdesai/lootloop/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'LootLoop',
      logo: {
        alt: 'LootLoop',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'wiki',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/samipdesai/lootloop',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Wiki',
          items: [
            { label: 'Overview', to: '/' },
            { label: 'Architecture', to: '/architecture/system' },
            { label: 'Data model', to: '/backend/data-model' },
          ],
        },
        {
          title: 'Repo',
          items: [
            { label: 'GitHub', href: 'https://github.com/samipdesai/lootloop' },
            {
              label: 'Technical plan',
              href: 'https://github.com/samipdesai/lootloop/blob/main/lootloop-technical-plan.md',
            },
          ],
        },
      ],
      copyright: `LootLoop internal documentation.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['sql', 'bash', 'json'],
    },
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
