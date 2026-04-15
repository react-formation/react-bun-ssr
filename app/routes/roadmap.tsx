import { Link } from 'react-bun-ssr/route';
import { SITE_NAME, serializeJsonLd, toAbsoluteUrl } from '../lib/site';
import styles from './roadmap.module.css';

const stableNow = [
  'Bun-native SSR runtime and production server entrypoints',
  'File-based page, API, layout, group, and markdown routes',
  'Server loaders, React form actions, middleware, and response helpers',
  'Streaming SSR, deferred loader data, and soft client transitions',
  'Docs-first project structure with generated API docs and search index',
];

const nearTerm = [
  'More evergreen examples and comparison pages for common adoption decisions',
  'Tighter SEO and structured-data checks as part of docs validation',
  'More production deployment notes for Bun hosting environments',
  'More request-runtime boundary tests around document projection and transitions',
  'Clearer release notes and migration notes as APIs stabilize',
];

const nonGoals = [
  'Do not become a clone of Next.js or Remix.',
  'Do not hide Bun behind a generic Node adapter model.',
  'Do not add React Server Components until the framework has a coherent Bun-native story for them.',
  'Do not optimize for every hosting platform before the core runtime is stable.',
  'Do not turn the docs site into a demo-first marketing app.',
];

export default function RoadmapPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="roadmap-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Project roadmap</p>
          <h1 id="roadmap-title">A small Bun-native React SSR framework, intentionally grown in public.</h1>
          <p className={styles.lead}>
            `react-bun-ssr` is experimental. The roadmap focuses on making the current SSR,
            routing, data, and deployment model more credible before expanding the framework surface.
          </p>
          <div className={styles.actions} aria-label="Roadmap actions">
            <Link className={styles.primaryCta} to="/docs/start/quick-start">
              Try the Quick Start
            </Link>
            <Link className={styles.secondaryCta} to="/examples">
              Browse Examples
            </Link>
            <a className={styles.secondaryCta} href="https://github.com/react-formation/react-bun-ssr/issues">
              Open GitHub Issues
            </a>
          </div>
        </div>
        <aside className={styles.statusPanel} aria-label="Project status">
          <p>Status</p>
          <strong>Experimental early alpha</strong>
          <span>
            Expect breaking changes while core APIs, routing contracts, deployment behavior, and
            docs ergonomics continue to settle.
          </span>
        </aside>
      </section>

      <section className={styles.columns} aria-labelledby="roadmap-sections-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Direction</p>
          <h2 id="roadmap-sections-title">Stabilize the useful core before widening the surface.</h2>
        </div>
        <article>
          <h3>Stable enough to evaluate now</h3>
          <ul>
            {stableNow.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Near-term focus</h3>
          <ul>
            {nearTerm.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Current non-goals</h3>
          <ul>
            {nonGoals.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.nextSteps} aria-labelledby="next-steps-title">
        <div>
          <p className={styles.eyebrow}>Evaluate safely</p>
          <h2 id="next-steps-title">Use the docs, examples, and benchmarks before adopting it broadly.</h2>
          <p>
            The safest path is to build the Task Tracker, review the benchmark scope, and compare
            the framework honestly with Next.js before deciding whether the Bun-native tradeoff fits.
          </p>
        </div>
        <div className={styles.calloutLinks}>
          <Link to="/docs/start/quick-start">Build the Task Tracker</Link>
          <Link to="/benchmarks">Review benchmarks</Link>
          <Link to="/comparison/react-bun-ssr-vs-nextjs">Compare with Next.js</Link>
        </div>
      </section>
    </main>
  );
}

export function head() {
  const canonicalUrl = toAbsoluteUrl('/roadmap');
  const description = 'Read the react-bun-ssr roadmap for Bun-native React SSR, including stable framework capabilities, near-term priorities, and explicit non-goals.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'react-bun-ssr Roadmap for Bun-Native React SSR',
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: toAbsoluteUrl('/docs'),
    },
  };

  return (
    <>
      <title>react-bun-ssr Roadmap for Bun-Native React SSR</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content="react-bun-ssr Roadmap for Bun-Native React SSR" />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="react-bun-ssr Roadmap for Bun-Native React SSR" />
      <meta name="twitter:description" content={description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  );
}
