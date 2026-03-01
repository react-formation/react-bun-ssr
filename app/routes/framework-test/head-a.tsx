import { Link } from "react-bun-ssr/route";
import styles from "./head-a.module.css";

export default function FrameworkHeadARoute() {
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Head A</h1>
      <p id="head-style-box" className={styles.box}>alpha</p>
      <Link id="go-head-b" to="/framework-test/head-b">Go to head B</Link>
    </main>
  );
}

export function head() {
  return <title>Framework head A</title>;
}
