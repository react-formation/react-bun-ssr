import type { RouteSegment } from "./types";

export interface RouteSpecificityComparable {
  score: number;
  segments: RouteSegment[];
  routePath: string;
}

export function sortRoutesBySpecificity<T extends RouteSpecificityComparable>(
  routes: T[],
): T[] {
  return routes.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    if (a.segments.length !== b.segments.length) {
      return b.segments.length - a.segments.length;
    }

    return a.routePath.localeCompare(b.routePath);
  });
}
