import type {
  AnchorHTMLAttributes,
  FocusEvent,
  MouseEvent,
  TouchEvent,
} from "react";

interface NavigateInfo {
  from: string;
  to: string;
  status: number;
  kind: "page" | "not_found" | "catch" | "error";
  redirected: boolean;
  prefetched: boolean;
}

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: "intent" | "none";
  onNavigate?: (info: NavigateInfo) => void;
}

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  if (event.defaultPrevented) {
    return false;
  }

  if (event.button !== 0) {
    return false;
  }

  if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
    return false;
  }

  return true;
}

function toAbsoluteHref(to: string): string {
  if (typeof window === "undefined") {
    return to;
  }
  return new URL(to, window.location.href).toString();
}

function isInternalHref(href: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function isSameDocumentHashNavigation(href: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const target = new URL(href, window.location.href);
    return (
      target.origin === window.location.origin
      && target.pathname === window.location.pathname
      && target.search === window.location.search
      && target.hash.length > 0
    );
  } catch {
    return false;
  }
}

async function prefetch(href: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const runtime = await import("./client-runtime");
  await runtime.prefetchTo(href);
}

async function navigate(href: string, options: {
  replace?: boolean;
  scroll?: boolean;
  onNavigate?: (info: NavigateInfo) => void;
}): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const runtime = await import("./client-runtime");
  await runtime.navigateWithNavigationApiOrFallback(href, {
    replace: options.replace,
    scroll: options.scroll,
    onNavigate: options.onNavigate,
  });
}

export function Link(props: LinkProps) {
  const {
    to,
    replace = false,
    scroll = true,
    prefetch: prefetchMode = "intent",
    onNavigate,
    onMouseEnter,
    onTouchStart,
    onFocus,
    onClick,
    target,
    rel,
    download,
    ...rest
  } = props;

  const href = to;
  const resolvedHref = toAbsoluteHref(to);

  const maybePrefetch = (): void => {
    if (prefetchMode !== "intent") {
      return;
    }

    if (!isInternalHref(resolvedHref)) {
      return;
    }

    void prefetch(resolvedHref);
  };

  const handleMouseEnter = (event: MouseEvent<HTMLAnchorElement>): void => {
    onMouseEnter?.(event);
    if (event.defaultPrevented) {
      return;
    }
    maybePrefetch();
  };

  const handleTouchStart = (event: TouchEvent<HTMLAnchorElement>): void => {
    onTouchStart?.(event);
    if (event.defaultPrevented) {
      return;
    }
    maybePrefetch();
  };

  const handleFocus = (event: FocusEvent<HTMLAnchorElement>): void => {
    onFocus?.(event);
    if (event.defaultPrevented) {
      return;
    }
    maybePrefetch();
  };

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    if (!shouldHandleNavigation(event)) {
      return;
    }

    if (download !== undefined) {
      return;
    }

    if (target && target !== "_self") {
      return;
    }

    if (!isInternalHref(resolvedHref)) {
      return;
    }

    if (isSameDocumentHashNavigation(resolvedHref)) {
      return;
    }

    event.preventDefault();
    void navigate(resolvedHref, {
      replace,
      scroll,
      onNavigate,
    });
  };

  return (
    <a
      {...rest}
      href={href}
      target={target}
      rel={rel}
      download={download}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onFocus={handleFocus}
    />
  );
}
