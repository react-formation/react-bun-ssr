import { useEffect, useState } from 'react';
import { Link, Outlet, useRequestUrl } from 'react-bun-ssr/route';
import manifestData from './docs-manifest.json';
import { sidebar, type DocKind, type SidebarSection } from './_sidebar';
import { openDocsSearch } from '../../components/docs-search';
import styles from './_layout.module.css';
const EDIT_BASE = 'https://github.com/react-formation/react-bun-ssr/blob/main/app/routes/docs';

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

function getCurrentSlug(pathname: string): string {
  const withoutPrefix = pathname.replace(/^\/docs\/?/, '');
  return withoutPrefix.replace(/\/+$/, '');
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
  const sidebarData = sidebar as SidebarSection[];

  const [menuOpen, setMenuOpen] = useState(false);

  const currentSlug = getCurrentSlug(url.pathname);
  const currentEntry = manifest.find(entry => entry.slug === currentSlug) ?? null;
  const prev = currentEntry?.prevSlug
    ? manifest.find(entry => entry.slug === currentEntry.prevSlug) ?? null
    : null;
  const next = currentEntry?.nextSlug
    ? manifest.find(entry => entry.slug === currentEntry.nextSlug) ?? null
    : null;

  useEffect(() => {
    setMenuOpen(false);
  }, [currentSlug]);

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
            onClick={() => {
              setMenuOpen(false);
              openDocsSearch();
            }}
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
    </main>
  );
}
