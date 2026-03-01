import { redirect } from "react-bun-ssr/route";

export function loader() {
  return redirect("/framework-test/redirect-target");
}

export default function FrameworkRedirectSourceRoute() {
  return <main />;
}
