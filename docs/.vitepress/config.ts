import { defineConfig } from 'vitepress';

const repository = process.env.GITHUB_REPOSITORY;
const repoName = repository?.split('/')[1];
const base = process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : '/';

export default defineConfig({
  title: 'MockIt',
  description: 'REST API mocking for TypeScript and JavaScript projects',
  lang: 'en-US',
  base,
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Installation', link: '/guide/installation' },
      { text: 'Usage', link: '/guide/usage' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Documentation',
          items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Usage', link: '/guide/usage' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Released under the MIT License.',
    },
  },
});
