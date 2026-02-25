import { json } from "react-bun-ssr";
import { loadSearchIndex } from "../../lib/docs";

export function GET() {
  return json(loadSearchIndex());
}
