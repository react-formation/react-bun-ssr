import { Link } from 'react-bun-ssr/route';
import { SITE_NAME, serializeJsonLd, toAbsoluteUrl } from '../../lib/site';
import { createBreadcrumbList } from '../../lib/structured-data';
import styles from './react-bun-ssr-vs-nextjs.module.css';

const comparisonPath = '/comparison/react-bun-ssr-vs-nextjs';

const tradeoffs = [
  {
    title: 'Runtime model',
    rbssr: 'Bun-native server, build, file, markdown, and runtime APIs are the starting point.',
    nextjs: 'Node and Vercel ecosystem integration are the center of gravity, with broader runtime targets.',
  },
  {
    title: 'Framework scope',
    rbssr: 'Small SSR framework focused on file routes, loaders, actions, streaming, and markdown routes.',
    nextjs: 'Full-stack React platform with App Router, React Server Components, image/font tooling, and hosted platform integrations.',
  },
  {
    title: 'Best current fit',
    rbssr: 'Docs, content-heavy SSR apps, Bun-first projects, and teams that want a smaller request/runtime surface.',
    nextjs: 'Large product apps needing a mature ecosystem, RSC architecture, broad hosting support, and many batteries included.',
  },
  {
    title: 'Operational tradeoff',
    rbssr: 'Less framework surface and fewer abstractions, but a younger ecosystem and more responsibility for app decisions.',
    nextjs: 'More ecosystem defaults and integrations, but more framework behavior to learn, configure, and debug.',
  },
];

const chooseRbssr = [
  'You want server-rendered React built directly on Bun rather than a Node-oriented adapter stack.',
  'Your app is content-heavy, documentation-heavy, or benefits from first-class markdown routes.',
  'You prefer explicit loaders, actions, middleware, and route files over a larger full-stack platform.',
  'You are comfortable adopting an experimental framework while the API surface is still being shaped.',
];

const chooseNext = [
  'You need the mature Next.js ecosystem, hosting defaults, and broad team familiarity.',
  'You want React Server Components as a central application architecture primitive.',
  'You depend on mature image, font, caching, deployment, and platform integrations out of the box.',
  'You need low organizational risk more than a small Bun-native runtime surface.',
];

export default function ReactBunSsrVsNextjsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="comparison-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Framework comparison</p>
          <h1 id="comparison-title">react-bun-ssr vs Next.js for Bun-native React SSR.</h1>
          <p className={styles.lead}>
            This comparison is not a claim that one framework is universally better. It explains
            where `react-bun-ssr` is intentionally smaller and Bun-first, and where Next.js remains
            the safer, broader platform choice.
          </p>
          <div className={styles.actions} aria-label="Comparison actions">
            <Link className={styles.primaryCta} to="/docs/start/quick-start">
              Try react-bun-ssr
            </Link>
            <Link className={styles.secondaryCta} to="/benchmarks">
              Review Benchmarks
            </Link>
            <a className={styles.secondaryCta} href="https://github.com/react-formation/react-bun-ssr">
              View GitHub
            </a>
          </div>
        </div>
        <aside className={styles.positioningPanel} aria-label="Short comparison summary">
          <p>Short version</p>
          <strong>Use `react-bun-ssr` when Bun is the architectural choice, not only the command runner.</strong>
          <span>
            Use Next.js when ecosystem maturity, React Server Components, and hosted platform
            integrations matter more than a smaller Bun-native SSR surface.
          </span>
        </aside>
      </section>

      <section className={styles.tradeoffs} aria-labelledby="tradeoffs-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Tradeoffs</p>
          <h2 id="tradeoffs-title">The real difference is scope and runtime ownership.</h2>
        </div>
        <div className={styles.tradeoffGrid}>
          {tradeoffs.map(item => (
            <article key={item.title} className={styles.tradeoffCard}>
              <h3>{item.title}</h3>
              <div>
                <p className={styles.columnLabel}>react-bun-ssr</p>
                <p>{item.rbssr}</p>
              </div>
              <div>
                <p className={styles.columnLabel}>Next.js</p>
                <p>{item.nextjs}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.choiceGrid} aria-labelledby="decision-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Decision guide</p>
          <h2 id="decision-title">Choose based on your constraints, not framework hype.</h2>
        </div>
        <article>
          <h3>Choose react-bun-ssr when...</h3>
          <ul>
            {chooseRbssr.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Choose Next.js when...</h3>
          <ul>
            {chooseNext.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.evidence} aria-labelledby="evidence-title">
        <div>
          <p className={styles.eyebrow}>Evidence</p>
          <h2 id="evidence-title">Benchmarks support the current content-heavy SSR story.</h2>
          <p>
            The benchmark is intentionally narrow: markdown content and local-data SSR on the same
            machine, in production mode, against Next.js 16.2.1 on Node 24. It is useful evidence,
            not a universal performance guarantee.
          </p>
        </div>
        <div className={styles.calloutLinks}>
          <Link to="/benchmarks">Open benchmark summary</Link>
          <Link to="/blog/a-small-honest-rbssr-vs-nextjs-benchmark">Read full methodology</Link>
          <Link to="/docs/rendering/streaming-deferred">Read rendering docs</Link>
        </div>
      </section>
    </main>
  );
}

export function head() {
  const canonicalUrl = toAbsoluteUrl(comparisonPath);
  const description = 'Compare react-bun-ssr with Next.js for Bun-native React SSR, including runtime model, framework scope, benchmarks, tradeoffs, and adoption guidance.';
  const breadcrumbJsonLd = createBreadcrumbList([
    { name: 'Comparison', pathname: comparisonPath },
    { name: 'react-bun-ssr vs Next.js', pathname: comparisonPath },
  ]);
  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'react-bun-ssr vs Next.js for Bun-native React SSR',
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: toAbsoluteUrl('/docs'),
    },
    about: [
      'react-bun-ssr vs Next.js',
      'Bun-native React SSR',
      'React SSR framework comparison',
    ],
  };

  return (
    <>
      <title>react-bun-ssr vs Next.js for Bun React SSR</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content="react-bun-ssr vs Next.js for Bun React SSR" />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="react-bun-ssr vs Next.js for Bun React SSR" />
      <meta name="twitter:description" content={description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }}
      />
    </>
  );
}
