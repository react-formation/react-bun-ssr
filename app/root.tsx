import { Outlet, useRouteError } from "react-bun-ssr/route";

export default function RootLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="brand">
          react-bun-ssr
        </a>
        <nav>
          <a href="/">Home</a>
          <a href="/posts/first-post">Dynamic Route</a>
          <a href="/contact">Action Route</a>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export function head() {
  return (
    <>
      <title>react-bun-ssr</title>
      <link rel="icon" type="image/svg+xml" href="/logo.svg" />
      <link rel="stylesheet" href="/app.css" />
    </>
  );
}

export function meta() {
  return {
    description: "Bun-native fully SSR React framework",
  };
}

export function NotFound() {
  return (
    <section className="card">
      <h1>404</h1>
      <p>The page you requested does not exist.</p>
      <p>
        <a href="/">Back to home</a>
      </p>
    </section>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <section className="card">
      <h1>Something failed</h1>
      <pre>{String(error instanceof Error ? error.message : error)}</pre>
      <p>
        <a href="/">Back to home</a>
      </p>
    </section>
  );
}
