import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useRequestUrl } from 'react-bun-ssr/route';
import searchIndexData from '../routes/docs/search-index.json';
import type { DocKind } from '../routes/docs/_sidebar';
import styles from './docs-search.module.css';

export const DOCS_SEARCH_EVENT = 'rbssr:open-docs-search';

interface HeadingEntry {
  text: string;
  id: string;
  depth: number;
}

interface SearchRecord {
  id: string;
  title: string;
  navTitle: string;
  section: string;
  kind: DocKind;
  excerpt: string;
  url: string;
  tags: string[];
  headings: HeadingEntry[];
  tokens: string[];
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function kindLabel(kind: DocKind): string {
  switch (kind) {
    case 'api':
      return 'API';
    case 'guide':
      return 'Guide';
    case 'migration':
      return 'Migration';
    case 'overview':
      return 'Overview';
    case 'reference':
    default:
      return 'Reference';
  }
}

export function openDocsSearch(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(DOCS_SEARCH_EVENT));
}

export default function DocsSearch() {
  const url = useRequestUrl();
  const searchIndex = searchIndexData as SearchRecord[];
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim();

    if (!normalized) {
      return searchIndex.slice(0, 12);
    }

    return searchIndex
      .map(record => {
        let score = 0;
        const title = record.title.toLowerCase();
        const navTitle = record.navTitle.toLowerCase();
        const section = record.section.toLowerCase();
        const excerpt = record.excerpt.toLowerCase();
        const tags = record.tags.join(' ').toLowerCase();
        const headings = record.headings.map(heading => heading.text.toLowerCase()).join(' ');

        if (title.includes(normalized)) score += 10;
        if (navTitle.includes(normalized)) score += 8;
        if (section.includes(normalized)) score += 4;
        if (tags.includes(normalized)) score += 4;
        if (headings.includes(normalized)) score += 3;
        if (excerpt.includes(normalized)) score += 2;
        if (record.tokens.some(token => token.includes(normalized))) score += 1;

        return { record, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.record.url.localeCompare(b.record.url))
      .slice(0, 12)
      .map(entry => entry.record);
  }, [query, searchIndex]);

  useEffect(() => {
    setSearchOpen(false);
    setQuery('');
  }, [url.pathname]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    const handleOpenSearch = (): void => {
      setSearchOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(DOCS_SEARCH_EVENT, handleOpenSearch as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(DOCS_SEARCH_EVENT, handleOpenSearch as EventListener);
    };
  }, []);

  if (!searchOpen) {
    return null;
  }

  return (
    <div className={styles.searchOverlay} role="dialog" aria-modal="true" aria-label="Search docs">
      <button
        type="button"
        className={styles.searchBackdrop}
        aria-label="Close search"
        onClick={() => setSearchOpen(false)}
      />
      <div className={styles.searchPanel}>
        <div className={styles.searchPanelHeader}>
          <p>Search documentation</p>
          <button type="button" onClick={() => setSearchOpen(false)}>
            Close
          </button>
        </div>
        <input
          ref={inputRef}
          id="docs-search"
          className={styles.searchInput}
          placeholder="Search guides, API pages, headings, and tags"
          value={query}
          onChange={event => setQuery(event.currentTarget.value)}
        />
        <div className={styles.searchResults}>
          {results.length === 0 ? (
            <p className={styles.searchEmpty}>No result for “{query}”.</p>
          ) : null}
          {results.map(record => (
            <Link
              key={record.id}
              to={record.url}
              className={styles.searchResult}
              onClick={() => setSearchOpen(false)}
            >
              <div className={styles.searchResultMeta}>
                <span>{record.section}</span>
                <span>{kindLabel(record.kind)}</span>
              </div>
              <strong>{record.title}</strong>
              <p>{record.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
