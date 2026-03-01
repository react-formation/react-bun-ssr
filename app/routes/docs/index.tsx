import { Link } from 'react-bun-ssr/route';
import blogManifestData from '../blog/blog-manifest.json';
import manifestData from './docs-manifest.json';
import { sidebar } from './_sidebar';
import styles from './index.module.css';

interface DocManifestEntry {
  slug: string;
  title: string;
  navTitle: string;
  description: string;
  section: string;
  kind: 'overview' | 'guide' | 'reference' | 'api' | 'migration';
}

interface BlogManifestEntry {
  slug: string;
  title: string;
  description: string;
  author: string;
  publishedLabel: string;
}

const featuredValues = [
  {
    title: 'Bun-native runtime',
    description: 'No Node adapter layer. The runtime, build, markdown, and server paths stay Bun-first.',
  },
  {
    title: 'File-based routing',
    description: 'Pages, APIs, layouts, groups, and markdown routes live in one coherent route tree.',
  },
  {
    title: 'Loaders, actions, and defer',
    description: 'Data loading, mutation, and progressive streaming are built into the route contract.',
  },
  {
    title: 'Streaming SSR',
    description: 'Full document streaming and deferred payloads work for first load and soft transitions.',
  },
  {
    title: 'Client transitions',
    description: 'Link and useRouter preserve shared layouts while moving across server-rendered pages.',
  },
  {
    title: 'Markdown routes',
    description: 'Author docs as first-class .md route files without hand-written TSX wrappers.',
  },
];

export default function DocsHomePage() {
  const manifest = manifestData as DocManifestEntry[];
  const blogManifest = blogManifestData as BlogManifestEntry[];
  const guideCount = manifest.filter(entry => entry.kind === 'guide').length;
  const latestPost = blogManifest[0] ?? null;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Bun-native framework docs</p>
          <h1>Server-rendered React on Bun, without pretending Bun is Node.</h1>
          <p className={styles.lead}>
            `react-bun-ssr` gives you file-based routing, streaming SSR, deferred data,
            client transitions, and first-class markdown routes in one Bun-first stack.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryCta} to="/docs/start/quick-start">
              Start with Quick Start
            </Link>
            <Link className={styles.secondaryCta} to="/docs/routing/file-based-routing">
              Explore Routing
            </Link>
            <Link className={styles.secondaryCta} to="/docs/api/overview">
              Open API Reference
            </Link>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <p>Install and boot the docs-grade defaults</p>
          <pre>
            <code>{`bun --version\nmkdir task-tracker\ncd task-tracker\nrbssr init\nbun install\nbun run dev`}</code>
          </pre>
          <div className={styles.heroStats}>
            <div>
              <strong>{manifest.length}</strong>
              <span>reference pages</span>
            </div>
            <div>
              <strong>{guideCount}</strong>
              <span>guided walkthroughs</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.pathGrid}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Choose your path</p>
          <h2>Start with guided onboarding, then drill into the exact runtime surface.</h2>
        </div>
        <div className={styles.cards}>
          {sidebar
            .filter(section => ['start', 'routing', 'data', 'rendering', 'deployment'].includes(section.id))
            .map(section => (
              <section key={section.id} className={styles.card}>
                <p className={styles.cardEyebrow}>{section.title}</p>
                <ul>
                  {section.items.slice(0, 3).map(item => (
                    <li key={item.slug}>
                      <Link to={`/docs/${item.slug}`}>{item.title}</Link>
                      <span>{item.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </section>

      <section className={styles.valueSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Why teams pick it</p>
          <h2>Opinionated where it helps, small where it should stay out of the way.</h2>
        </div>
        <div className={styles.valueGrid}>
          {featuredValues.map(item => (
            <article key={item.title} className={styles.valueCard}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.callout}>
        <div>
          <p className={styles.eyebrow}>Generated reference</p>
          <h2>API pages stay generated, but they now link back into the guides that explain why each export exists.</h2>
          <p>
            Start with the curated API overview, then move into the generated package pages when you
            need exact signatures.
          </p>
        </div>
        <div className={styles.calloutLinks}>
          <Link to="/docs/api/overview">API Overview</Link>
          <Link to="/docs/api/react-bun-ssr">react-bun-ssr</Link>
          <Link to="/docs/api/react-bun-ssr-route">react-bun-ssr/route</Link>
        </div>
      </section>

      {latestPost ? (
        <section className={styles.blogCallout}>
          <div>
            <p className={styles.eyebrow}>From the blog</p>
            <h2>{latestPost.title}</h2>
            <p>
              {latestPost.description} Written by {latestPost.author} on {latestPost.publishedLabel}.
            </p>
          </div>
          <div className={styles.calloutLinks}>
            <Link to={`/blog/${latestPost.slug}`}>Read the article</Link>
            <Link to="/blog">Open the blog</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function head() {
  return <title>react-bun-ssr | Documentation</title>;
}

export function meta() {
  return {
    description: 'Bun-native SSR React framework docs covering routing, data, rendering, styling, tooling, and deployment.',
    'og:title': 'react-bun-ssr | Documentation',
    'og:type': 'website',
  };
}
