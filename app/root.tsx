import { useEffect } from 'react';
import { Link, Outlet } from 'react-bun-ssr/route';
import { initDatadogRum } from './lib/datadog-rum';
import styles from './root.module.css';

export default function RootLayout() {
  useEffect(() => {
    void initDatadogRum();
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} to="/docs/getting-started/introduction">
          <img
            className={styles.brandLogo}
            src="/logo.svg"
            alt="react-bun-ssr"
            width={28}
            height={28}
          />
          <span>react-bun-ssr</span>
        </Link>
        <nav className={styles.topnav}>
          <Link to="/docs/getting-started/introduction">Docs</Link>
          <Link to="/docs/api-reference/overview">API</Link>
          <a href="https://github.com/gaudiauj/react-bun-ssr">GitHub</a>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

export function head() {
  return (
    <>
      <title>react-bun-ssr documentation</title>
      <meta
        name="description"
        content="Bun-native fully SSR React framework documentation"
      />
      <meta
        name="google-site-verification"
        content="sI7GYFWWtoQhNipsdQncDKnJiehzPk8prWjj3H7zFJU"
      />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.svg" />
      <link rel="stylesheet" href="/app.css" />
    </>
  );
}

export function NotFound() {
  return (
    <main className={styles.singleMain}>
      <section className={styles.card}>
        <h1>404</h1>
        <p>Documentation page not found.</p>
        <p>
          <Link to="/docs/getting-started/introduction">Go to introduction</Link>
        </p>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <main className={styles.singleMain}>
      <section className={styles.card}>
        <h1>500</h1>
        <p>Something failed while rendering this page.</p>
      </section>
    </main>
  );
}
