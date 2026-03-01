import { Component, Suspense, use, type ReactNode } from "react";
import { defer, useLoaderData } from "react-bun-ssr/route";

interface DeferredRejectRouteData {
  immediate: string;
  slow: Promise<string>;
}

export async function loader() {
  return defer({
    immediate: "shell-ready",
    slow: new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("deferred-rejected")), 300);
    }),
  });
}

function DeferredValue(props: { value: Promise<string> }) {
  const resolved = use(props.value);
  return <p id="deferred-rejected-value">{resolved}</p>;
}

class DeferredErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = {
    error: null as Error | null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <p id="deferred-rejected">{this.state.error.message}</p>;
    }

    return this.props.children;
  }
}

export default function FrameworkDeferredRejectRoute() {
  const data = useLoaderData<DeferredRejectRouteData>();

  return (
    <main style={{ padding: "1rem" }}>
      <h1>Deferred rejection route</h1>
      <p id="deferred-immediate">{data.immediate}</p>
      <DeferredErrorBoundary>
        <Suspense fallback={<p id="deferred-fallback">Loading deferred value...</p>}>
          <DeferredValue value={data.slow} />
        </Suspense>
      </DeferredErrorBoundary>
    </main>
  );
}

export function head() {
  return <title>Deferred rejection route</title>;
}
