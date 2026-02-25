import { json } from "react-bun-ssr";
import searchIndex from "../docs/search-index.json";

export function GET() {
  return json(searchIndex);
}
