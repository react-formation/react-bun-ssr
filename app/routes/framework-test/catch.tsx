import { routeError, type RouteErrorResponse } from "react-bun-ssr/route";

export function loader() {
  throw routeError(418, { reason: "teapot" });
}

export default function FrameworkCatchRoute() {
  return <main />;
}

export function CatchBoundary(props: { error: RouteErrorResponse }) {
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Caught boundary</h1>
      <p id="caught-status">{String(props.error.status)}</p>
      <p id="caught-reason">{String((props.error.data as { reason?: string } | undefined)?.reason ?? "")}</p>
    </main>
  );
}

export function head() {
  return <title>Caught boundary</title>;
}
