export function loader() {
  throw new Error("framework-test-boom");
}

export default function FrameworkErrorRoute() {
  return <main />;
}

export function ErrorComponent(props: { error: unknown }) {
  const message = props.error instanceof Error ? props.error.message : String(props.error);

  return (
    <main style={{ padding: "1rem" }}>
      <h1>Error boundary</h1>
      <p id="error-message">{message}</p>
    </main>
  );
}

export function head() {
  return <title>Error boundary</title>;
}
