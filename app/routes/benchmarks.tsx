import { Link } from 'react-bun-ssr/route';
import { SITE_NAME, serializeJsonLd, toAbsoluteUrl } from '../lib/site';
import styles from './benchmarks.module.css';

const benchmarkPostPath = '/blog/a-small-honest-rbssr-vs-nextjs-benchmark';
const benchmarkRepoUrl = 'https://github.com/react-formation/react-bun-ssr-benchmark';

const scenarios = [
  {
    route: '/content',
    description: 'Docs-like markdown content rendered as a first-class route.',
    rbssr: '3686.68 req/s, 26.61ms avg latency, 50ms p95',
    next: '517.27 req/s, 192.20ms avg latency, 231ms p95',
  },
  {
    route: '/data',
    description: 'Local JSON read on every request plus server-rendered 100-item catalog HTML.',
    rbssr: '640.91 req/s, 155.06ms avg latency, 230ms p95',
    next: '170.23 req/s, 580.81ms avg latency, 626ms p95',
  },
];

const constraints = [
  'Production mode only, with one app running at a time on localhost.',
  'Same authored markdown fixture and same local-data SSR route shape.',
  'No CDN, compression tuning, database, remote fetches, edge runtime, or dev mode.',
  'Numbers are local-machine results, not a universal claim for every React app.',
];

export default function BenchmarksPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="benchmarks-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Benchmark evidence</p>
          <h1 id="benchmarks-title">Bun-native React SSR benchmarked against a modern Next.js baseline.</h1>
          <p className={styles.lead}>
            The current benchmark compares `react-bun-ssr` on Bun with Next.js 16.2.1 on Node 24
            across two production SSR scenarios: markdown content and local-data rendering.
          </p>
          <div className={styles.actions} aria-label="Benchmark actions">
            <Link className={styles.primaryCta} to={benchmarkPostPath}>
              Read the full benchmark
            </Link>
            <Link className={styles.secondaryCta} to="/docs/start/quick-start">
              Try the Quick Start
            </Link>
            <Link className={styles.secondaryCta} to="/comparison/react-bun-ssr-vs-nextjs">
              Compare with Next.js
            </Link>
            <a className={styles.secondaryCta} href={benchmarkRepoUrl}>
              Open benchmark repo
            </a>
          </div>
        </div>

        <aside className={styles.summaryPanel} aria-label="Benchmark summary">
          <p className={styles.panelLabel}>Measured setup</p>
          <dl>
            <div>
              <dt>Framework</dt>
              <dd>react-bun-ssr 0.4.0 on Bun 1.3.10</dd>
            </div>
            <div>
              <dt>Baseline</dt>
              <dd>Next.js 16.2.1 on Node 24.14.1</dd>
            </div>
            <div>
              <dt>Machine</dt>
              <dd>Apple M1 Pro, local production servers</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Key results</p>
          <h2 id="results-title">Fast builds and strong content-heavy SSR throughput.</h2>
          <p>
            The strongest signal is the markdown route, which lines up with a core framework
            design choice: `.md` files are first-class routes in a Bun-native rendering pipeline.
          </p>
        </div>

        <div className={styles.metricGrid}>
          <article>
            <span>Clean build</span>
            <strong>0.16s</strong>
            <p>Median clean build for `react-bun-ssr`, compared with 3.13s for Next.js.</p>
          </article>
          <article>
            <span>/content</span>
            <strong>7x</strong>
            <p>Approximate warm-serve req/s advantage in the markdown content scenario.</p>
          </article>
          <article>
            <span>/data</span>
            <strong>3.8x</strong>
            <p>Approximate warm-serve req/s advantage in the local-data SSR scenario.</p>
          </article>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <caption>Warm-serve benchmark scenarios</caption>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Scenario</th>
                <th scope="col">react-bun-ssr</th>
                <th scope="col">Next.js baseline</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(scenario => (
                <tr key={scenario.route}>
                  <th scope="row">{scenario.route}</th>
                  <td>{scenario.description}</td>
                  <td>{scenario.rbssr}</td>
                  <td>{scenario.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.caveats} aria-labelledby="caveats-title">
        <div>
          <p className={styles.eyebrow}>Honest scope</p>
          <h2 id="caveats-title">What this benchmark claims, and what it does not.</h2>
          <p>
            This page is a stable summary, not a broad performance promise. The full article keeps
            the methodology and interpretation explicit so the results stay useful and defensible.
          </p>
        </div>
        <ul>
          {constraints.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.nextSteps} aria-labelledby="next-steps-title">
        <div>
          <p className={styles.eyebrow}>Next step</p>
          <h2 id="next-steps-title">Use the benchmark as evidence, then evaluate the framework shape.</h2>
          <p>
            If the content-heavy SSR profile matches your app, start with the docs and reproduce
            the benchmark from the standalone repository before making architecture decisions.
          </p>
        </div>
        <div className={styles.calloutLinks}>
          <Link to="/docs/start/quick-start">Build the Task Tracker</Link>
          <Link to="/comparison/react-bun-ssr-vs-nextjs">Compare with Next.js</Link>
          <Link to="/docs/rendering/streaming-deferred">Read streaming docs</Link>
          <Link to={benchmarkPostPath}>Full benchmark article</Link>
        </div>
      </section>
    </main>
  );
}

export function head() {
  const canonicalUrl = toAbsoluteUrl('/benchmarks');
  const description = 'Review honest react-bun-ssr benchmarks for Bun-native React SSR, including measured scenarios, constraints, caveats, and links to full writeups.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'react-bun-ssr Benchmarks for Bun React SSR',
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: toAbsoluteUrl('/docs'),
    },
    about: [
      'Bun React SSR benchmarks',
      'react-bun-ssr performance',
      'Next.js benchmark comparison',
    ],
  };

  return (
    <>
      <title>react-bun-ssr Benchmarks for Bun React SSR</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content="react-bun-ssr Benchmarks for Bun React SSR" />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="react-bun-ssr Benchmarks for Bun React SSR" />
      <meta name="twitter:description" content={description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  );
}
