import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useRequestUrl } from 'react-bun-ssr/route';
import manifestData from './docs-manifest.json';
import searchIndexData from './search-index.json';
import { sidebar, type DocKind, type SidebarSection } from './_sidebar';
import styles from './_layout.module.css';

const DOCS_SEARCH_EVENT = 'rbssr:open-docs-search';
const EDIT_BASE = 'https://github.com/gaudiauj/react-bun-ssr/blob/main/app/routes/docs';

interface HeadingEntry {
  text: string;
  id: string;
  depth: number;
}

interface DocManifestEntry {
  slug: string;
  title: string;
  navTitle: string;
  description: string;
  section: string;
  kind: DocKind;
  order: number;
  tags: string[];
  headings: HeadingEntry[];
  prevSlug?: string;
  nextSlug?: string;
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

function getCurrentSlug(pathname: string): string {
  const withoutPrefix = pathname.replace(/^\/docs\/?/, '');
  return withoutPrefix.replace(/\/+$/, '');
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

export default function DocsLayoutRoute() {
  const url = useRequestUrl();
  const manifest = manifestData as DocManifestEntry[];
  const searchIndex = searchIndexData as SearchRecord[];
  const sidebarData = sidebar as SidebarSection[];

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentSlug = getCurrentSlug(url.pathname);
  const currentEntry = manifest.find(entry => entry.slug === currentSlug) ?? null;
  const prev = currentEntry?.prevSlug
    ? manifest.find(entry => entry.slug === currentEntry.prevSlug) ?? null
    : null;
  const next = currentEntry?.nextSlug
    ? manifest.find(entry => entry.slug === currentEntry.nextSlug) ?? null
    : null;

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
    setMenuOpen(false);
    setSearchOpen(false);
    setQuery('');
  }, [currentSlug]);

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

  return (
    <main className={styles.layout}>
      <button
        type="button"
        className={styles.menuToggle}
        aria-expanded={menuOpen}
        aria-controls="docs-sidebar"
        onClick={() => setMenuOpen(value => !value)}
      >
        {menuOpen ? 'Close navigation' : 'Browse guides'}
      </button>

      {menuOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        id="docs-sidebar"
        className={`${styles.sidebar}${menuOpen ? ` ${styles.sidebarOpen}` : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <p className={styles.sidebarEyebrow}>Documentation</p>
          <button
            type="button"
            className={styles.sidebarSearch}
            onClick={() => setSearchOpen(true)}
          >
            <span>Search docs</span>
            <kbd>/</kbd>
          </button>
        </div>

        <div className={styles.sidebarBody}>
          <nav className={styles.nav}>
            {sidebarData.map(section => (
              <section key={section.id} className={styles.navSection}>
                <h2>{section.title}</h2>
                <div className={styles.navItems}>
                  {section.items.map(item => {
                    const active = item.slug === currentSlug;
                    return (
                      <Link
                        key={item.slug}
                        to={`/docs/${item.slug}`}
                        className={`${styles.navLink}${active ? ` ${styles.navLinkActive}` : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className={styles.navLinkTitle}>{item.title}</span>
                        <span className={styles.navLinkDescription}>{item.description}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </div>
      </aside>

      <div className={`${styles.contentColumn}${currentEntry ? '' : ` ${styles.contentColumnWide}`}`}>
        {currentEntry ? (
          <div className={styles.pageMeta}>
            <div className={styles.pageMetaGroup}>
              <span className={styles.kindBadge}>{kindLabel(currentEntry.kind)}</span>
              <span className={styles.pageSection}>{currentEntry.section}</span>
            </div>
            <a href={`${EDIT_BASE}/${currentEntry.slug}.md`} target="_blank" rel="noreferrer">
              Edit this page
            </a>
          </div>
        ) : null}

        <article className={styles.article}>
          <Outlet />
        </article>

        {currentEntry ? (
          <footer className={styles.pagination}>
            {prev ? (
              <Link className={styles.paginationCard} to={`/docs/${prev.slug}`}>
                <small>Previous</small>
                <strong>{prev.navTitle}</strong>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className={styles.paginationCard} to={`/docs/${next.slug}`}>
                <small>Next</small>
                <strong>{next.navTitle}</strong>
              </Link>
            ) : (
              <span />
            )}
          </footer>
        ) : null}
      </div>

      {currentEntry && currentEntry.headings.length > 0 ? (
        <aside className={styles.toc}>
          <div className={styles.tocCard}>
            <p className={styles.tocEyebrow}>On this page</p>
            <nav className={styles.tocNav}>
              {currentEntry.headings.map(heading => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  className={`${styles.tocLink}${heading.depth > 2 ? ` ${styles.tocLinkNested}` : ''}`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      ) : null}

      {searchOpen ? (
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
      ) : null}
    </main>
  );
}
