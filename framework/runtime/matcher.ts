import type {
  ApiRouteDefinition,
  PageRouteDefinition,
  Params,
  RouteMatch,
  RouteSegment,
} from "./types";

function normalizePathname(pathname: string): string[] {
  if (!pathname || pathname === "/") {
    return [];
  }

  return pathname
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .map(part => decodeURIComponent(part));
}

function matchSegments(segments: RouteSegment[], pathname: string): Params | null {
  const pathParts = normalizePathname(pathname);
  const params: Params = {};

  let i = 0;
  let j = 0;

  while (i < segments.length) {
    const segment = segments[i]!;

    if (segment.kind === "catchall") {
      params[segment.value] = pathParts.slice(j).join("/");
      return params;
    }

    const current = pathParts[j];
    if (current === undefined) {
      return null;
    }

    if (segment.kind === "static") {
      if (segment.value !== current) {
        return null;
      }
    } else {
      params[segment.value] = current;
    }

    i += 1;
    j += 1;
  }

  if (j !== pathParts.length) {
    return null;
  }

  return params;
}

export function matchPageRoute(
  routes: PageRouteDefinition[],
  pathname: string,
): RouteMatch<PageRouteDefinition> | null {
  for (const route of routes) {
    const params = matchSegments(route.segments, pathname);
    if (params) {
      return { route, params };
    }
  }

  return null;
}

export function matchApiRoute(
  routes: ApiRouteDefinition[],
  pathname: string,
): RouteMatch<ApiRouteDefinition> | null {
  for (const route of routes) {
    const params = matchSegments(route.segments, pathname);
    if (params) {
      return { route, params };
    }
  }

  return null;
}
