import { useMemo, useState } from "react";
import { useLoaderData } from "react-bun-ssr/route";
import type { Loader } from "react-bun-ssr/route";

interface DocHeading {
  level: number;
  id: string;
  text: string;
}

interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  tags: string[];
  order: number;
  html: string;
  headings: DocHeading[];
  toc: DocHeading[];
}

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

interface LoaderData {
  page: DocPage;
  sidebar: SidebarSection[];
  neighbors: {
    prev: SidebarItem | null;
    next: SidebarItem | null;
  };
  searchIndex: SearchRecord[];
}

function createMissingPage(slug: string): DocPage {
  return {
    slug,
    title: "Documentation page not found",
    description: "This slug is not registered in docs metadata.",
    section: "Not Found",
    tags: [],
    order: 0,
    html: "<p>Check the sidebar and navigate to an existing documentation page.</p>",
    headings: [{ level: 1, id: "documentation-page-not-found", text: "Documentation page not found" }],
    toc: [{ level: 1, id: "documentation-page-not-found", text: "Documentation page not found" }],
  };
}

export const loader: Loader = async ({ params }) => {
  const docs = await import("../../lib/docs");
  const slugValue = params.slug ?? "";
  const slug = slugValue.split("/").filter(Boolean).join("/");

  if (!slug) {
    throw new Error("Missing docs slug");
  }

  const knownSlugs = new Set(docs.getAllDocSlugs());
  if (!knownSlugs.has(slug)) {
    return {
      page: createMissingPage(slug),
      sidebar: docs.getDocsSidebar(),
      neighbors: { prev: null, next: null },
      searchIndex: docs.loadSearchIndex(),
    } satisfies LoaderData;
  }

  return {
    page: docs.loadDocPage(slug),
    sidebar: docs.getDocsSidebar(),
    neighbors: docs.resolveDocNeighbors(slug),
    searchIndex: docs.loadSearchIndex(),
  } satisfies LoaderData;
};

export default function DocsPageRoute() {
  const data = useLoaderData<LoaderData>();
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");

  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) {
      return [];
    }

    return data.searchIndex
      .filter(item => (sectionFilter === "all" ? true : item.section === sectionFilter))
      .map(item => {
        let score = 0;
        if (item.title.toLowerCase().includes(normalized)) {
          score += 5;
        }
        if (item.headings.some(heading => heading.toLowerCase().includes(normalized))) {
          score += 3;
        }
        if (item.tokens.some(token => token.includes(normalized))) {
          score += 1;
        }
        return { item, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [data.searchIndex, query, sectionFilter]);

  const sections = Array.from(new Set(data.searchIndex.map(item => item.section))).sort();

  return (
    <main className="docs-main">
      <aside className="docs-sidebar">
        <label className="search-label" htmlFor="docs-search">
          Search docs
        </label>
        <input
          id="docs-search"
          className="search-input"
          placeholder="Search title, headings, keywords"
          value={query}
          onChange={event => setQuery(event.currentTarget.value)}
        />
        <select
          className="search-select"
          value={sectionFilter}
          onChange={event => setSectionFilter(event.currentTarget.value)}
        >
          <option value="all">All sections</option>
          {sections.map(section => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>

        {query ? (
          <div className="search-results">
            {results.map(result => (
              <a key={result.item.id} href={result.item.url} className="search-result-item">
                <strong>{result.item.title}</strong>
                <span>{result.item.excerpt}</span>
              </a>
            ))}
            {results.length === 0 ? <p className="muted">No result.</p> : null}
          </div>
        ) : null}

        <nav className="docs-nav">
          {data.sidebar.map(section => (
            <section key={section.section}>
              <h3>{section.section}</h3>
              {section.items.map(item => {
                const href = `/docs/${item.slug}`;
                const active = item.slug === data.page.slug;
                return (
                  <a key={item.slug} href={href} aria-current={active ? "page" : undefined}>
                    {item.title}
                  </a>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      <article className="docs-content">
        <header className="docs-hero">
          <p className="kicker">{data.page.section}</p>
          <h1>{data.page.title}</h1>
          <p>{data.page.description}</p>
        </header>

        {data.page.toc.length > 1 ? (
          <nav className="toc">
            <h2>On this page</h2>
            {data.page.toc.map(item => (
              <a key={item.id} href={`#${item.id}`}>
                {item.text}
              </a>
            ))}
          </nav>
        ) : null}

        <section dangerouslySetInnerHTML={{ __html: data.page.html }} />

        <footer className="docs-pagination">
          {data.neighbors.prev ? (
            <a href={`/docs/${data.neighbors.prev.slug}`}>Previous: {data.neighbors.prev.title}</a>
          ) : (
            <span />
          )}
          {data.neighbors.next ? (
            <a href={`/docs/${data.neighbors.next.slug}`}>Next: {data.neighbors.next.title}</a>
          ) : (
            <span />
          )}
        </footer>
      </article>
    </main>
  );
}

export function head({ data }: { data: LoaderData }) {
  return <title>{`${data.page.title} | react-bun-ssr docs`}</title>;
}

export function meta({ data }: { data: LoaderData }) {
  return {
    description: data.page.description,
  };
}

export function ErrorBoundary() {
  return (
    <main className="docs-main docs-single">
      <section className="card">
        <h1>Docs load error</h1>
        <p>This page could not be loaded from markdown content.</p>
      </section>
    </main>
  );
}
