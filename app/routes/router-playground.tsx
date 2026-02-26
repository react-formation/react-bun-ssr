import { useRouter } from "react-bun-ssr/route";

export default function RouterPlaygroundRoute() {
  const router = useRouter();

  return (
    <main style={{ padding: "1rem" }}>
      <h1>Router playground</h1>
      <p>Programmatic navigation using useRouter().</p>
      <button
        id="router-push-loaders"
        type="button"
        onClick={() => router.push("/docs/core-concepts/loaders")}
      >
        Push to loaders
      </button>
      <button
        id="router-replace-actions"
        type="button"
        onClick={() => router.replace("/docs/core-concepts/actions")}
      >
        Replace with actions
      </button>
    </main>
  );
}

export function head() {
  return <title>Router playground</title>;
}
