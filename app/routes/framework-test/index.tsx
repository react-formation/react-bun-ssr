import { Link, useRequestUrl } from "react-bun-ssr/route";

export default function FrameworkTestIndexRoute() {
  const url = useRequestUrl();
  const crossOriginTarget = `http://localhost:${url.port || "3000"}/framework-test/head-a`;

  return (
    <main style={{ padding: "1rem", display: "grid", gap: "0.75rem" }}>
      <h1>Framework test routes</h1>
      <p>Hidden routes used by the refactor-safety Playwright suite.</p>

      <div style={{ display: "grid", gap: "0.5rem", justifyItems: "start" }}>
        <Link id="link-head-a" to="/framework-test/head-a">Head A</Link>
        <Link id="link-head-b" to="/framework-test/head-b">Head B</Link>
        <Link id="replace-head-b" to="/framework-test/head-b" replace>Replace Head B</Link>
        <Link id="prefetch-head-b" to="/framework-test/head-b">Prefetch Head B</Link>
        <Link id="deferred-link" to="/framework-test/deferred">Deferred route</Link>
        <Link id="deferred-reject-link" to="/framework-test/deferred-reject">Deferred reject route</Link>
        <Link id="catch-link" to="/framework-test/catch">Catch route</Link>
        <Link id="error-link" to="/framework-test/error">Error route</Link>
        <Link id="not-found-link" to="/framework-test/not-found">Not found route</Link>
        <Link id="redirect-link" to="/framework-test/redirect-source">Redirect route</Link>
        <Link id="cross-origin-link" to={crossOriginTarget}>
          Cross-origin head A
        </Link>
      </div>
    </main>
  );
}

export function head() {
  return <title>Framework test routes</title>;
}
