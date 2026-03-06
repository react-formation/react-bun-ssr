import {
  RBSSR_HEAD_MARKER_END_ATTR,
  RBSSR_HEAD_MARKER_START_ATTR,
} from "./runtime-constants";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;

export function isContentInsensitiveHeadTag(tagName: string): boolean {
  const normalized = tagName.toLowerCase();
  return normalized === "script" || normalized === "style" || normalized === "noscript";
}

function normalizeNodeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function nodeSignature(node: Node): string {
  if (node.nodeType === TEXT_NODE) {
    return `text:${node.textContent ?? ""}`;
  }

  if (node.nodeType === COMMENT_NODE) {
    return `comment:${node.textContent ?? ""}`;
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return `node:${node.nodeType}`;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const attrs = Array.from(element.attributes)
    .map(attribute => `${attribute.name}=${attribute.value}`)
    .sort((a, b) => a.localeCompare(b))
    .join("|");

  if (isContentInsensitiveHeadTag(tagName)) {
    return `element:${tagName}:${attrs}`;
  }

  if (tagName === "title") {
    return `element:${tagName}:${attrs}:${normalizeNodeText(element.textContent ?? "")}`;
  }

  // Keep generic element identity structural and cheap: no innerHTML serialization.
  return `element:${tagName}:${attrs}:${normalizeNodeText(element.textContent ?? "")}:${element.childElementCount}`;
}

function isIgnorableTextNode(node: Node): boolean {
  return node.nodeType === TEXT_NODE && (node.textContent ?? "").trim().length === 0;
}

function getManagedHeadNodes(startMarker: Element, endMarker: Element): Node[] {
  const nodes: Node[] = [];
  let cursor = startMarker.nextSibling;
  while (cursor && cursor !== endMarker) {
    nodes.push(cursor);
    cursor = cursor.nextSibling;
  }
  return nodes;
}

function removeNode(node: Node): void {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

function isStylesheetLinkNode(node: Node): node is HTMLLinkElement {
  if (node.nodeType !== ELEMENT_NODE) {
    return false;
  }

  const element = node as Element;
  return (
    element.tagName.toLowerCase() === "link"
    && (element.getAttribute("rel")?.toLowerCase() ?? "") === "stylesheet"
    && Boolean(element.getAttribute("href"))
  );
}

function toAbsoluteHref(href: string, baseUri: string): string {
  return new URL(href, baseUri).toString();
}

function resolveBaseUri(documentRef: Document): string {
  const candidate = documentRef.baseURI;
  if (typeof candidate === "string" && candidate.length > 0) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "about:") {
        return candidate;
      }
    } catch {
      // fall back below
    }
  }

  return "http://localhost/";
}

function waitForStylesheetLoad(link: HTMLLinkElement): Promise<void> {
  if (!link.ownerDocument.defaultView || link.sheet) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const finish = () => {
      link.removeEventListener("load", finish);
      link.removeEventListener("error", finish);
      resolve();
    };

    link.addEventListener("load", finish, { once: true });
    link.addEventListener("error", finish, { once: true });
  });
}

async function reconcileStylesheetLinks(options: {
  head: HTMLHeadElement;
  desiredStylesheetHrefs: string[];
  baseUri: string;
}): Promise<void> {
  const desiredAbsoluteHrefs = options.desiredStylesheetHrefs.map(href => toAbsoluteHref(href, options.baseUri));
  const existingLinks = Array.from(
    options.head.querySelectorAll('link[rel="stylesheet"][href]'),
  ) as HTMLLinkElement[];

  const existingByAbsoluteHref = new Map<string, HTMLLinkElement[]>();
  for (const link of existingLinks) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }
    const absoluteHref = toAbsoluteHref(href, options.baseUri);
    const list = existingByAbsoluteHref.get(absoluteHref) ?? [];
    list.push(link);
    existingByAbsoluteHref.set(absoluteHref, list);
  }

  const waitForLoads: Promise<void>[] = [];
  for (let index = 0; index < options.desiredStylesheetHrefs.length; index += 1) {
    const href = options.desiredStylesheetHrefs[index]!;
    const absoluteHref = desiredAbsoluteHrefs[index]!;
    const existing = existingByAbsoluteHref.get(absoluteHref)?.[0];
    if (existing) {
      waitForLoads.push(waitForStylesheetLoad(existing));
      continue;
    }

    const link = options.head.ownerDocument.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", href);
    options.head.appendChild(link);
    waitForLoads.push(waitForStylesheetLoad(link));
  }

  const seen = new Set<string>();
  for (const link of Array.from(options.head.querySelectorAll('link[rel="stylesheet"][href]'))) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }

    const absoluteHref = toAbsoluteHref(href, options.baseUri);
    if (seen.has(absoluteHref)) {
      removeNode(link);
      continue;
    }

    seen.add(absoluteHref);
  }

  await Promise.all(waitForLoads);
}

export async function replaceManagedHead(
  headHtml: string,
  options: {
    documentRef?: Document;
    startMarkerAttr?: string;
    endMarkerAttr?: string;
  } = {},
): Promise<void> {
  const documentRef = options.documentRef ?? document;
  const startMarkerAttr = options.startMarkerAttr ?? RBSSR_HEAD_MARKER_START_ATTR;
  const endMarkerAttr = options.endMarkerAttr ?? RBSSR_HEAD_MARKER_END_ATTR;

  const head = documentRef.head;
  const startMarker = head.querySelector(`meta[${startMarkerAttr}]`);
  const endMarker = head.querySelector(`meta[${endMarkerAttr}]`);

  if (!startMarker || !endMarker || startMarker === endMarker) {
    return;
  }

  const template = documentRef.createElement("template");
  template.innerHTML = headHtml;

  const desiredStylesheetHrefs = Array.from(template.content.querySelectorAll('link[rel="stylesheet"][href]'))
    .map(link => link.getAttribute("href"))
    .filter((value): value is string => Boolean(value));
  for (const styleNode of Array.from(template.content.querySelectorAll('link[rel="stylesheet"][href]'))) {
    removeNode(styleNode);
  }

  const desiredNodes = Array.from(template.content.childNodes).filter(node => !isIgnorableTextNode(node));
  const currentNodes = getManagedHeadNodes(startMarker, endMarker).filter(node => {
    if (isIgnorableTextNode(node)) {
      return false;
    }

    if (isStylesheetLinkNode(node)) {
      return false;
    }

    return true;
  });
  const unusedCurrentNodes = new Set(currentNodes);

  let cursor = startMarker.nextSibling;

  // Structural identity only: avoid subtree HTML serialization in signature checks.
  for (const desiredNode of desiredNodes) {
    while (cursor && cursor !== endMarker && isIgnorableTextNode(cursor)) {
      const next = cursor.nextSibling;
      removeNode(cursor);
      cursor = next;
    }

    const desiredSignature = nodeSignature(desiredNode);

    if (cursor && cursor !== endMarker && nodeSignature(cursor) === desiredSignature) {
      unusedCurrentNodes.delete(cursor);
      cursor = cursor.nextSibling;
      continue;
    }

    let matchedNode: Node | null = null;
    for (const currentNode of currentNodes) {
      if (!unusedCurrentNodes.has(currentNode)) {
        continue;
      }
      if (nodeSignature(currentNode) === desiredSignature) {
        matchedNode = currentNode;
        break;
      }
    }

    if (matchedNode) {
      unusedCurrentNodes.delete(matchedNode);
      head.insertBefore(matchedNode, cursor ?? endMarker);
      continue;
    }

    head.insertBefore(desiredNode.cloneNode(true), cursor ?? endMarker);
  }

  for (const leftover of unusedCurrentNodes) {
    removeNode(leftover);
  }

  await reconcileStylesheetLinks({
    head,
    desiredStylesheetHrefs,
    baseUri: resolveBaseUri(documentRef),
  });
}
