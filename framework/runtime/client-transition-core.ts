import { matchRouteBySegments } from "./matcher";
import type {
  ClientRouteSnapshot,
  Params,
  TransitionChunk,
  TransitionDeferredChunk,
  TransitionDocumentChunk,
  TransitionInitialChunk,
  TransitionRedirectChunk,
} from "./types";

export const PREFETCH_TTL_MS = 30_000;
export const MAX_REDIRECT_DEPTH = 8;

export interface TransitionChunkParserState {
  buffer: string;
  initialChunk: TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null;
  deferredChunks: TransitionDeferredChunk[];
}

export interface TransitionNavigationOptions {
  historyManagedByNavigationApi?: boolean;
  isPopState?: boolean;
}

export function createTransitionChunkParserState(): TransitionChunkParserState {
  return {
    buffer: "",
    initialChunk: null,
    deferredChunks: [],
  };
}

export function matchClientPageRoute(
  routes: ClientRouteSnapshot[],
  pathname: string,
): { route: ClientRouteSnapshot; params: Params } | null {
  return matchRouteBySegments(routes, pathname);
}

function applyParsedTransitionChunk(
  state: TransitionChunkParserState,
  chunk: TransitionChunk,
): TransitionChunkParserState {
  if (chunk.type === "initial" || chunk.type === "redirect" || chunk.type === "document") {
    if (state.initialChunk) {
      return state;
    }

    return {
      ...state,
      initialChunk: chunk,
    };
  }

  return {
    ...state,
    deferredChunks: [...state.deferredChunks, chunk],
  };
}

export function consumeTransitionChunkText(
  state: TransitionChunkParserState,
  text: string,
): TransitionChunkParserState {
  let buffer = state.buffer + text;
  let nextState = {
    ...state,
    buffer: "",
  };

  let start = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== "\n") {
      continue;
    }

    const line = buffer.slice(start, index).trim();
    if (line.length > 0) {
      nextState = applyParsedTransitionChunk(
        nextState,
        JSON.parse(line) as TransitionChunk,
      );
    }
    start = index + 1;
  }

  buffer = buffer.slice(start);
  return {
    ...nextState,
    buffer,
  };
}

export function flushTransitionChunkText(
  state: TransitionChunkParserState,
): TransitionChunkParserState {
  const trailing = state.buffer.trim();
  if (trailing.length === 0) {
    return {
      ...state,
      buffer: "",
    };
  }

  return {
    ...applyParsedTransitionChunk(
      {
        ...state,
        buffer: "",
      },
      JSON.parse(trailing) as TransitionChunk,
    ),
    buffer: "",
  };
}

export function sanitizePrefetchCache<T extends { createdAt: number }>(
  cache: Map<string, T>,
  options: {
    now?: number;
    ttlMs?: number;
  } = {},
): void {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? PREFETCH_TTL_MS;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.createdAt > ttlMs) {
      cache.delete(key);
    }
  }
}

export function shouldSkipSoftNavigation(
  currentPath: string,
  targetPath: string,
  options: TransitionNavigationOptions,
): boolean {
  return (
    currentPath === targetPath
    && !options.isPopState
    && !options.historyManagedByNavigationApi
  );
}

export function shouldHardNavigateForRedirectDepth(
  depth: number,
  maxDepth = MAX_REDIRECT_DEPTH,
): boolean {
  return depth > maxDepth;
}

export function isStaleNavigationToken(
  activeToken: number,
  candidateToken: number,
): boolean {
  return activeToken !== candidateToken;
}
