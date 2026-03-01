import { notFound } from "react-bun-ssr/route";

export function loader() {
  throw notFound({ reason: "missing" });
}

export default function FrameworkNotFoundRoute() {
  return <main />;
}

export function NotFound() {
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Route-level not found</h1>
      <p id="route-not-found">Missing framework-test route data.</p>
    </main>
  );
}

export function head() {
  return <title>Route-level not found</title>;
}
