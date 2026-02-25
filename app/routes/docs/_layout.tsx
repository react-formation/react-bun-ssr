import { useMemo, useState } from 'react';
import { Outlet, useRequestUrl } from 'react-bun-ssr/route';
import { sidebar } from './_sidebar';
import searchIndexData from './search-index.json';
import styles from './_layout.module.css';

interface SidebarItem {
  title: string;
  slug: string;
}

interface SidebarSection {
  section: string;
  items: SidebarItem[];
}

interface SearchRecord {
  id: string;
  title: string;
  section: string;
  headings: string[];
  excerpt: string;
  url: string;
  tokens: string[];
}

function getCurrentSlug(pathname: string): string {
  const withoutPrefix = pathname.replace(/^\/docs\/?/, '');
  return withoutPrefix.replace(/\/+$/, '');
}

export default function DocsLayoutRoute() {
  const url = useRequestUrl();
  const searchIndex = searchIndexData as SearchRecord[];
  const sidebarData = sidebar as SidebarSection[];

  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);

  const currentSlug = getCurrentSlug(url.pathname);
  const flatItems = useMemo(
    () => sidebarData.flatMap((section) => section.items),
    [sidebarData],
  );
  const currentIndex = flatItems.findIndex((item) => item.slug === currentSlug);
  const prev = currentIndex > 0 ? (flatItems[currentIndex - 1] ?? null) : null;
  const next =
    currentIndex >= 0 && currentIndex < flatItems.length - 1
      ? (flatItems[currentIndex + 1] ?? null)
      : null;

  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return [];
    }

    return searchIndex
      .filter((item) =>
        sectionFilter === 'all' ? true : item.section === sectionFilter,
      )
      .map((item) => {
        let score = 0;
        if (item.title.toLowerCase().includes(normalized)) {
          score += 5;
        }
        if (
          item.headings.some((heading) =>
            heading.toLowerCase().includes(normalized),
          )
        ) {
          score += 3;
        }
        if (item.tokens.some((token) => token.includes(normalized))) {
          score += 1;
        }
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [query, searchIndex, sectionFilter]);

  const sections = Array.from(
    new Set(searchIndex.map((item) => item.section)),
  ).sort();

  return (
    <main className={styles.main}>
      <button
        type="button"
        className={styles.menuToggle}
        aria-expanded={menuOpen}
        aria-controls="docs-sidebar"
        onClick={() => setMenuOpen((value) => !value)}
      >
        {menuOpen ? 'Close menu' : 'Browse docs'}
      </button>

      {menuOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Close docs menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        id="docs-sidebar"
        className={`${styles.sidebar}${menuOpen ? ` ${styles.isOpen}` : ''}`}
      >
        <button
          type="button"
          className={styles.sidebarClose}
          onClick={() => setMenuOpen(false)}
          aria-label="Close docs menu"
        >
          Close
        </button>
        <label className={styles.searchLabel} htmlFor="docs-search">
          Search docs
        </label>
        <input
          id="docs-search"
          className={styles.searchInput}
          placeholder="Search title, headings, keywords"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <select
          className={styles.searchSelect}
          value={sectionFilter}
          onChange={(event) => setSectionFilter(event.currentTarget.value)}
        >
          <option value="all">All sections</option>
          {sections.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>

        {query ? (
          <div className={styles.results}>
            {results.map((result) => (
              <a
                key={result.item.id}
                href={result.item.url}
                className={`${styles.resultItem} search-result-item`}
                onClick={() => setMenuOpen(false)}
              >
                <strong>{result.item.title}</strong>
                <span>{result.item.excerpt}</span>
              </a>
            ))}
            {results.length === 0 ? <p className={styles.muted}>No result.</p> : null}
          </div>
        ) : null}

        <nav className={styles.nav}>
          {sidebarData.map((section) => (
            <section key={section.section}>
              <h3>{section.section}</h3>
              {section.items.map((item) => {
                const href = `/docs/${item.slug}`;
                const active = item.slug === currentSlug;
                return (
                  <a
                    key={item.slug}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.title}
                  </a>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      <article className={styles.content}>
        <Outlet />
        <footer className={styles.pagination}>
          {prev ? (
            <a href={`/docs/${prev.slug}`}>Previous: {prev.title}</a>
          ) : (
            <span />
          )}
          {next ? (
            <a href={`/docs/${next.slug}`}>Next: {next.title}</a>
          ) : (
            <span />
          )}
        </footer>
      </article>
    </main>
  );
}
