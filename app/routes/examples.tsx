import { Link } from 'react-bun-ssr/route';
import { SITE_NAME, serializeJsonLd, toAbsoluteUrl } from '../lib/site';
import styles from './examples.module.css';

const examples = [
  {
    title: 'Task Tracker starter',
    description: 'Build a small route tree with a page route, shared layout, loader, action, and middleware.',
    docsPath: '/docs/start/quick-start',
    docsLabel: 'Open Quick Start',
    code: `app/routes/tasks.tsx
app/routes/tasks.server.ts
app/routes/_layout.tsx
app/routes/_middleware.server.ts`,
  },
  {
    title: 'Server loader data',
    description: 'Fetch server-owned data, return deferred values, and hydrate the same route payload on the client.',
    docsPath: '/docs/data/loaders',
    docsLabel: 'Read loader docs',
    code: `export const loader: Loader = async () => {
  return defer({
    tasks: await getTasks(),
    activity: getActivity(),
  });
};`,
  },
  {
    title: 'React form action',
    description: 'Use React useActionState with a client action stub and a server companion action.',
    docsPath: '/docs/data/actions',
    docsLabel: 'Read action docs',
    code: `export const action = createRouteAction<FormState>();

const [state, formAction] = useActionState(action, initialState);`,
  },
  {
    title: 'Streaming SSR route',
    description: 'Stream the full document while slower loader keys resolve behind Suspense boundaries.',
    docsPath: '/docs/rendering/streaming-deferred',
    docsLabel: 'Read streaming docs',
    code: `<Suspense fallback={<p>Loading activity...</p>}>
  <ActivityFeed data={activityPromise} />
</Suspense>`,
  },
  {
    title: 'API route handler',
    description: 'Return JSON from API routes that share the same route tree and middleware model as pages.',
    docsPath: '/docs/routing/file-based-routing',
    docsLabel: 'Read routing docs',
    code: `export function GET() {
  return json({ ok: true });
}`,
  },
  {
    title: 'Bun deployment',
    description: 'Build client/server artifacts and start the generated Bun server without a Node adapter layer.',
    docsPath: '/docs/deployment/bun-deployment',
    docsLabel: 'Read deployment docs',
    code: `bun run build
bun run start`,
  },
];

export default function ExamplesPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="examples-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Framework examples</p>
          <h1 id="examples-title">Representative react-bun-ssr examples for Bun-native React apps.</h1>
          <p className={styles.lead}>
            These examples are compact entry points into the docs. Use them to understand how route
            files, loaders, actions, streaming, API handlers, and Bun deployment fit together.
          </p>
          <div className={styles.actions} aria-label="Example actions">
            <Link className={styles.primaryCta} to="/docs/start/quick-start">
              Start with Quick Start
            </Link>
            <Link className={styles.secondaryCta} to="/benchmarks">
              Review Benchmarks
            </Link>
            <a className={styles.secondaryCta} href="https://github.com/react-formation/react-bun-ssr">
              View GitHub
            </a>
          </div>
        </div>
        <aside className={styles.summaryPanel} aria-label="Examples summary">
          <p>What this page covers</p>
          <ul>
            <li>Route files and layouts</li>
            <li>Loaders and actions</li>
            <li>Streaming and deferred data</li>
            <li>API routes and Bun deployment</li>
          </ul>
        </aside>
      </section>

      <section className={styles.examplesGrid} aria-labelledby="examples-grid-title">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Use cases</p>
          <h2 id="examples-grid-title">Start from a concrete pattern, then open the deeper guide.</h2>
        </div>
        <div className={styles.cards}>
          {examples.map(example => (
            <article key={example.title} className={styles.card}>
              <div>
                <h3>{example.title}</h3>
                <p>{example.description}</p>
              </div>
              <pre>
                <code>{example.code}</code>
              </pre>
              <Link className={styles.cardCta} to={example.docsPath}>
                {example.docsLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.nextSteps} aria-labelledby="next-steps-title">
        <div>
          <p className={styles.eyebrow}>Next step</p>
          <h2 id="next-steps-title">Validate the shape against the comparison and benchmark pages.</h2>
          <p>
            Examples show what the framework feels like in code. Benchmarks and comparisons explain
            when this smaller Bun-native stack is the right tradeoff.
          </p>
        </div>
        <div className={styles.calloutLinks}>
          <Link to="/comparison/react-bun-ssr-vs-nextjs">Compare with Next.js</Link>
          <Link to="/benchmarks">Read benchmarks</Link>
          <Link to="/docs/api/overview">Open API reference</Link>
        </div>
      </section>
    </main>
  );
}

export function head() {
  const canonicalUrl = toAbsoluteUrl('/examples');
  const description = 'Explore react-bun-ssr examples for Bun-native React apps, including route files, loaders, actions, streaming SSR, API handlers, and deployment.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'react-bun-ssr Examples for Bun React Apps',
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: toAbsoluteUrl('/docs'),
    },
    mainEntity: examples.map(example => ({
      '@type': 'CreativeWork',
      name: example.title,
      description: example.description,
      url: toAbsoluteUrl(example.docsPath),
    })),
  };

  return (
    <>
      <title>react-bun-ssr Examples for Bun React Apps</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content="react-bun-ssr Examples for Bun React Apps" />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="react-bun-ssr Examples for Bun React Apps" />
      <meta name="twitter:description" content={description} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
    </>
  );
}
