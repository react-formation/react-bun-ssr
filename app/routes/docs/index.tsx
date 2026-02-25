import { redirect } from "react-bun-ssr";
import type { Loader } from "react-bun-ssr/route";

const DEFAULT_DOC_SLUG = "getting-started/introduction";

export const loader: Loader = () => {
  return redirect(`/docs/${DEFAULT_DOC_SLUG}`);
};

export default function DocsIndexRoute() {
  return null;
}
