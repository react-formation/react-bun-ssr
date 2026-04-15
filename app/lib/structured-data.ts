import { SITE_NAME, SITE_URL, toAbsoluteUrl } from './site';

interface BreadcrumbItem {
  name: string;
  pathname: string;
}

export function createBreadcrumbList(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.pathname),
    })),
  };
}

export function createWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };
}

export function createSoftwareSourceCodeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: SITE_NAME,
    description: 'Bun-native SSR React framework with file-based routing, loaders, actions, streaming SSR, and first-class markdown routes.',
    codeRepository: 'https://github.com/react-formation/react-bun-ssr',
    programmingLanguage: ['TypeScript', 'TSX'],
    runtimePlatform: 'Bun',
    url: SITE_URL,
    license: 'https://opensource.org/license/mit',
  };
}
