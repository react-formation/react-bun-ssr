import type {
  ApiRouteDefinition,
  PageRouteDefinition,
  Params,
  RouteMatch,
  RouteSegment,
} from "./types";

// Bun FileSystemRouter is the runtime matcher used by the server for projected routes.
// This matcher is used by server fallbacks and client transition matching.
// It intentionally does first-match linear scanning and expects routes to be pre-ordered
// by specificity (higher score first, then longer segment length, then routePath).
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

export function matchRouteBySegments<T extends { segments: RouteSegment[] }>(
  routes: T[],
  pathname: string,
): { route: T; params: Params } | null {
  for (const route of routes) {
    const params = matchSegments(route.segments, pathname);
    if (params) {
      return { route, params };
    }
  }

  return null;
}

export function matchPageRoute(
  routes: PageRouteDefinition[],
  pathname: string,
): RouteMatch<PageRouteDefinition> | null {
  return matchRouteBySegments(routes, pathname);
}

export function matchApiRoute(
  routes: ApiRouteDefinition[],
  pathname: string,
): RouteMatch<ApiRouteDefinition> | null {
  return matchRouteBySegments(routes, pathname);
}
