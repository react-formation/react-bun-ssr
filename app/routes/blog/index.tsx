import { Link } from 'react-bun-ssr/route';
import { SITE_NAME, serializeJsonLd, toAbsoluteUrl } from '../../lib/site';
import manifestData from './blog-manifest.json';
import styles from './index.module.css';

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
}

export default function BlogIndexPage() {
  const posts = manifestData as BlogManifestEntry[];
  const latest = posts[0] ?? null;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Engineering blog</p>
          <h1>Building a Bun-native React SSR framework in public.</h1>
          <p className={styles.lead}>
            Writing about the tradeoffs behind `react-bun-ssr`: why it exists, why it is a Bun-first
            React framework, what is already working, and what still needs to be built.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryCta} to={latest ? `/blog/${latest.slug}` : '/docs'}>
              {latest ? 'Read the first post' : 'Open the docs'}
            </Link>
            <Link className={styles.secondaryCta} to="/docs/start/quick-start">
              Start with Quick Start
            </Link>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <p>What you will find here</p>
          <ul>
            <li>Framework architecture decisions</li>
            <li>Bun-native React SSR tradeoffs</li>
            <li>Roadmap notes and implementation direction</li>
            <li>Benchmarks and deployment learnings over time</li>
          </ul>
        </div>
      </section>

      <section className={styles.listing}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Latest writing</p>
          <h2>Latest posts</h2>
        </div>

        <div className={styles.cards}>
          {posts.map(post => (
            <article key={post.slug} className={styles.card}>
              <div className={styles.cardMeta}>
                <span>{post.author}</span>
                <span>{post.publishedLabel}</span>
                <span>{post.readingMinutes} min read</span>
              </div>
              <h3>
                <Link to={`/blog/${post.slug}`}>{post.title}</Link>
              </h3>
              <p className={styles.cardDescription}>{post.description}</p>
              <div className={styles.cardTags}>
                {post.tags.map(tag => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <p className={styles.cardExcerpt}>{post.excerpt}...</p>
              <Link className={styles.cardCta} to={`/blog/${post.slug}`}>
                Read article
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function head() {
  const posts = manifestData as BlogManifestEntry[];
  const canonicalUrl = toAbsoluteUrl('/blog');
  const description = 'Essays, implementation notes, and roadmap writing about building react-bun-ssr as a Bun-native React SSR framework.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${SITE_NAME} Blog`,
    description,
    url: canonicalUrl,
    mainEntity: posts.map(post => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: post.canonicalUrl,
      datePublished: post.publishedAt,
      author: {
        '@type': 'Person',
        name: post.author,
      },
    })),
  };

  return (
    <>
      <title>{`${SITE_NAME} Blog`}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={`${SITE_NAME} Blog`} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={`${SITE_NAME} Blog`} />
      <meta name="twitter:description" content={description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  );
}
