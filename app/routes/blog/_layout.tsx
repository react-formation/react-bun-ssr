import { Link, Outlet, useRequestUrl } from 'react-bun-ssr/route';
import { SITE_NAME, SITE_URL, serializeJsonLd } from '../../lib/site';
import manifestData from './blog-manifest.json';
import styles from './_layout.module.css';

interface HeadingEntry {
  text: string;
  id: string;
  depth: number;
}

interface BlogManifestEntry {
  slug: string;
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  publishedLabel: string;
  tags: string[];
  excerpt: string;
  readingMinutes: number;
  canonicalUrl: string;
  headings: HeadingEntry[];
}

function getCurrentSlug(pathname: string): string {
  const withoutPrefix = pathname.replace(/^\/blog\/?/, '');
  return withoutPrefix.replace(/\/+$/, '');
}

function findEntry(pathname: string): BlogManifestEntry | null {
  const slug = getCurrentSlug(pathname);
  if (!slug) {
    return null;
  }

  const manifest = manifestData as BlogManifestEntry[];
  return manifest.find(entry => entry.slug === slug) ?? null;
}

export default function BlogLayoutRoute() {
  const url = useRequestUrl();
  const currentEntry = findEntry(url.pathname);

  if (!currentEntry) {
    return <Outlet />;
  }

  return (
    <main className={styles.layout}>
      <div className={styles.contentColumn}>
        <Link className={styles.backLink} to="/blog">
          Back to blog
        </Link>

        <div className={styles.metaRow}>
          <div className={styles.metaGroup}>
            <span className={styles.metaPill}>{currentEntry.author}</span>
            <time className={styles.metaPill} dateTime={currentEntry.publishedAt}>
              {currentEntry.publishedLabel}
            </time>
            <span className={styles.metaPill}>{currentEntry.readingMinutes} min read</span>
          </div>
        </div>

        <article className={styles.article}>
          <Outlet />
        </article>
      </div>

      {currentEntry.headings.length > 0 ? (
        <aside className={styles.toc}>
          <div className={styles.tocCard}>
            <p className={styles.tocEyebrow}>On this article</p>
            <nav className={styles.tocNav}>
              {currentEntry.headings.map(heading => (
                <a
                  key={heading.id}
                  className={`${styles.tocLink}${heading.depth > 2 ? ` ${styles.tocLinkNested}` : ''}`}
                  href={`#${heading.id}`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

export function head(ctx: { url: URL }) {
  const currentEntry = findEntry(ctx.url.pathname);
  if (!currentEntry) {
    return null;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: currentEntry.title,
    description: currentEntry.description,
    author: {
      '@type': 'Person',
      name: currentEntry.author,
    },
    datePublished: currentEntry.publishedAt,
    dateModified: currentEntry.publishedAt,
    mainEntityOfPage: currentEntry.canonicalUrl,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    keywords: currentEntry.tags.join(', '),
  };

  return (
    <>
      <link rel="canonical" href={currentEntry.canonicalUrl} />
      <meta name="author" content={currentEntry.author} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={currentEntry.title} />
      <meta property="og:description" content={currentEntry.description} />
      <meta property="og:type" content="article" />
      <meta property="og:url" content={currentEntry.canonicalUrl} />
      <meta property="article:published_time" content={currentEntry.publishedAt} />
      <meta property="article:author" content={currentEntry.author} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={currentEntry.title} />
      <meta name="twitter:description" content={currentEntry.description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  );
}
