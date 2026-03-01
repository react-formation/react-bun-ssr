export interface MarkdownHeadingEntry {
  text: string;
  id: string;
  depth: number;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function plainTextFromHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function slugifyHeading(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'section';
}

export function addHeadingIds(html: string): string {
  const seen = new Map<string, number>();

  return html.replace(/<h([1-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/g, (match, depth, attrs, inner) => {
    const existingId = /\sid="([^"]+)"/.exec(attrs)?.[1];
    if (existingId) {
      return match;
    }

    const base = slugifyHeading(plainTextFromHtml(inner));
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return `<h${depth}${attrs} id="${Bun.escapeHTML(id)}">${inner}</h${depth}>`;
  });
}

export function extractHeadingEntriesFromHtml(html: string): MarkdownHeadingEntry[] {
  return Array.from(html.matchAll(/<h([1-6])\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)).map(match => ({
    depth: Number(match[1]),
    id: match[2] ?? '',
    text: plainTextFromHtml(match[3] ?? ''),
  }));
}
