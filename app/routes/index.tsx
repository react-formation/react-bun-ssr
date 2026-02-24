import { useState } from "react";
import { useLoaderData, type Middleware } from "react-bun-ssr/route";

type HomeData = {
  message: string;
  serverTime: string;
};

export function loader(): HomeData {
  return {
    message: "Edit app/routes/index.tsx and refresh.",
    serverTime: new Date().toISOString(),
  };
}

export const middleware: Middleware = async (ctx, next) => {
  const response = await next();
  response.headers.set("x-home-route", "true");
  return response;
};

export default function HomeRoute() {
  const data = useLoaderData<HomeData>();
  const [count, setCount] = useState(0);

  return (
    <section className="card stack">
      <h1>Bun SSR + Hydration</h1>
      <p>{data.message}</p>
      <p>
        Server render timestamp: <strong>{data.serverTime}</strong>
      </p>
      <p>
        <a href="/contact">Try action + redirect route</a>
      </p>
      <div className="row">
        <button type="button" onClick={() => setCount(value => value + 1)}>
          Hydrated counter
        </button>
        <span>{count}</span>
      </div>
      <ApiTester />
    </section>
  );
}

function ApiTester() {
  return (
    <form className="stack" method="get" action="/api/hello">
      <label htmlFor="name">Try API route:</label>
      <div className="row">
        <input id="name" name="name" placeholder="optional name" />
        <button type="submit">/api/hello</button>
      </div>
    </form>
  );
}

export function head() {
  return <title>react-bun-ssr | Home</title>;
}
