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
      { text: 'Features', link: '/guide/features' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Documentation',
          items: [
            { text: 'Installation', link: '/guide/installation' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/guide/features' },
          ],
        },
        {
          text: 'MockServer',
          items: [
            { text: 'Overview', link: '/guide/mock-server' },
            { text: 'Configure', link: '/guide/mock-server-configure' },
            { text: 'Start', link: '/guide/mock-server-start' },
            { text: 'Expectations', link: '/guide/mock-server-expectations' },
            { text: 'Verification', link: '/guide/mock-server-verification' },
            { text: 'Playwright', link: '/guide/mock-server-playwright' },
            { text: 'Sample', link: '/guide/mock-server-sample' },
          ],
        },
        {
          text: 'HttpInterceptor',
          items: [
            { text: 'Overview', link: '/guide/http-interceptor' },
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
