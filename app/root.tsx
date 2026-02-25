import { Outlet } from 'react-bun-ssr/route';
import styles from './root.module.css';

export default function RootLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/docs/getting-started/introduction">
          <img
            className={styles.brandLogo}
            src="/logo.svg"
            alt="react-bun-ssr"
            width={28}
            height={28}
          />
          <span>react-bun-ssr</span>
        </a>
        <nav className={styles.topnav}>
          <a href="/docs/getting-started/introduction">Docs</a>
          <a href="/docs/api-reference/overview">API</a>
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
          <a href="/docs/getting-started/introduction">Go to introduction</a>
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
