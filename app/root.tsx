import { useEffect } from 'react';
import { Link, Outlet, useRouter } from 'react-bun-ssr/route';
import DocsSearch, { openDocsSearch } from './components/docs-search';
import { SITE_NAME } from './lib/site';
import { initDatadogRum } from './lib/datadog-rum';
import { initGoogleAnalytics, trackPageView } from './lib/google-analytics';
import styles from './root.module.css';

export default function RootLayout() {
  const router = useRouter();
  router.onNavigate((nextUrl) => {
    trackPageView(nextUrl);
  });

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }
    void initDatadogRum();
    initGoogleAnalytics();
  }, []);

  const handleSearchClick = (): void => {
    openDocsSearch();
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link className={styles.brand} to="/docs">
            <img
              className={styles.brandLogo}
              src="/logo.svg"
              alt="react-bun-ssr"
              width={32}
              height={32}
            />
            <span className={styles.brandText}>
              <strong>react-bun-ssr</strong>
              <small>Bun-native SSR framework</small>
            </span>
          </Link>

          <div className={styles.actions}>
            <nav className={styles.topnav}>
              <Link to="/blog">Blog</Link>
              <Link to="/docs">Docs</Link>
              <Link to="/docs/api/overview">API</Link>
              <a href="https://github.com/react-formation/react-bun-ssr">GitHub</a>
            </nav>

            <button
              type="button"
              className={styles.searchButton}
              onClick={handleSearchClick}
              aria-label="Search documentation"
            >
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
          </div>
        </div>
      </header>
      <Outlet />
      <DocsSearch />
      <footer className={styles.siteFooter}>
        <div className={styles.siteFooterInner}>
          <p className={styles.siteFooterCopy}>react-bun-ssr</p>
          <nav className={styles.siteFooterNav} aria-label="Site footer">
            <Link to="/docs">Docs</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/docs/api/overview">API</Link>
            <a href="/sitemap.xml">Sitemap</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function head() {
  return (
    <>
      <title>{SITE_NAME}</title>
      <meta
        name="description"
        content="Bun-native SSR React framework, documentation, and engineering blog."
      />
      <meta
        name="google-site-verification"
        content="sI7GYFWWtoQhNipsdQncDKnJiehzPk8prWjj3H7zFJU"
      />

      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.svg" />
      <link rel="stylesheet" href="/app.css" />

      {process.env.NODE_ENV !== 'development' && (
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-NGRFMCYB9Z"></script>
      )}

    </>
  );
}

export function NotFound() {
  return (
    <main className={styles.singleMain}>
      <section className={styles.card}>
        <p className={styles.kicker}>404</p>
        <h1>Page not found.</h1>
        <p>The requested route does not exist in the current site map.</p>
        <div className={styles.cardLinks}>
          <Link to="/blog">Open the blog</Link>
          <Link to="/docs">Open documentation</Link>
        </div>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <main className={styles.singleMain}>
      <section className={styles.card}>
        <p className={styles.kicker}>500</p>
        <h1>Something failed while rendering this page.</h1>
        <p>
          Check the server logs, then reload the request or open another guide.
        </p>
      </section>
    </main>
  );
}
