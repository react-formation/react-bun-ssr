import { Outlet } from "react-bun-ssr/route";

export default function FrameworkTestLayoutRoute() {
  return <Outlet />;
}

export function meta() {
  return {
    robots: "noindex,nofollow",
  };
}

