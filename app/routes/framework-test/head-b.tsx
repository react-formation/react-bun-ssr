import { Link } from "react-bun-ssr/route";
import styles from "./head-b.module.css";

export default function FrameworkHeadBRoute() {
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Head B</h1>
      <p id="head-style-box" className={styles.box}>beta</p>
      <Link id="go-head-a" to="/framework-test/head-a">Go to head A</Link>
    </main>
  );
}

export function head() {
  return <title>Framework head B</title>;
}
