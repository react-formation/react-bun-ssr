import { Outlet } from 'react-bun-ssr/route';

export default function RootLayout() {
  return (
    <div className="docs-shell">
      <header className="docs-topbar">
        <a className="docs-brand" href="/docs/getting-started/introduction">
          <img
            className="docs-brand-logo"
            src="/logo.svg"
            alt="react-bun-ssr"
            width={28}
            height={28}
          />
          <span>react-bun-ssr</span>
        </a>
        <nav className="docs-topnav">
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
    <main className="docs-main docs-single">
      <section className="card">
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
    <main className="docs-main docs-single">
      <section className="card">
        <h1>500</h1>
        <p>Something failed while rendering this page.</p>
      </section>
    </main>
  );
}
