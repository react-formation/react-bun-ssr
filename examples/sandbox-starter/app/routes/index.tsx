import { useLoaderData } from "react-bun-ssr/route";

export function loader() {
  return {
    message: "Hello from react-bun-ssr",
    subtitle: "This app is the one-click sandbox starter.",
  };
}

export default function IndexRoute() {
  const data = useLoaderData<{ message: string; subtitle: string }>();

  return (
    <section>
      <p>{data.message}</p>
      <small>{data.subtitle}</small>
    </section>
  );
}
