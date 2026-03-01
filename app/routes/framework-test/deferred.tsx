import { Suspense, use } from "react";
import { defer, useLoaderData } from "react-bun-ssr/route";

interface DeferredRouteData {
  immediate: string;
  slow: Promise<string>;
}

export async function loader() {
  return defer({
    immediate: "shell-ready",
    slow: new Promise<string>((resolve) => {
      setTimeout(() => resolve("slow-settled"), 300);
    }),
  });
}

function DeferredValue(props: { value: Promise<string> }) {
  const resolved = use(props.value);
  return <p id="deferred-resolved">{resolved}</p>;
}

export default function FrameworkDeferredRoute() {
  const data = useLoaderData<DeferredRouteData>();

  return (
    <main style={{ padding: "1rem" }}>
      <h1>Deferred route</h1>
      <p id="deferred-immediate">{data.immediate}</p>
      <Suspense fallback={<p id="deferred-fallback">Loading deferred value...</p>}>
        <DeferredValue value={data.slow} />
      </Suspense>
    </main>
  );
}

export function head() {
  return <title>Deferred route</title>;
}
