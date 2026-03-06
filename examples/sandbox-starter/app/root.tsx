import { Outlet } from "react-bun-ssr/route";
import styles from "./root.module.css";

export default function RootLayout() {
  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <h1>react-bun-ssr sandbox starter</h1>
      </header>
      <section className={styles.content}>
        <Outlet />
      </section>
    </main>
  );
}

export function head() {
  return <title>react-bun-ssr sandbox starter</title>;
}
