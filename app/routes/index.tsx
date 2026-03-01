import { redirect } from "react-bun-ssr";
import type { Loader } from "react-bun-ssr/route";

export const loader: Loader = () => {
  return redirect("/docs");
};

export default function IndexRoute() {
  return null;
}
