export default function FrameworkRedirectTargetRoute() {
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Redirect target</h1>
      <p id="redirect-target">redirect-complete</p>
    </main>
  );
}

export function head() {
  return <title>Redirect target</title>;
}
