export type DocKind = "overview" | "guide" | "reference" | "api" | "migration";

export interface SidebarItem {
  title: string;
  slug: string;
  description: string;
  kind: DocKind;
}

export interface SidebarSection {
  id: string;
  title: string;
  items: SidebarItem[];
}

export const sidebar: SidebarSection[] = [
  {
    id: "start",
    title: "Start",
    items: [
      {
        title: "Overview",
        slug: "start/overview",
        description: "What react-bun-ssr is, where it fits, and what you build first.",
        kind: "overview",
      },
      {
        title: "Installation",
        slug: "start/installation",
        description: "Install Bun, scaffold a project, and run the docs-grade defaults locally.",
        kind: "guide",
      },
      {
        title: "Quick Start",
        slug: "start/quick-start",
        description: "Build the Task Tracker example from route files to a working SSR app.",
        kind: "guide",
      },
      {
        title: "Project Structure",
        slug: "start/project-structure",
        description: "Understand how routes, public assets, generated files, and framework internals fit together.",
        kind: "reference",
      },
      {
        title: "Dev/Build Lifecycle",
        slug: "start/dev-build-lifecycle",
        description: "What happens in dev, build, preview, and production server flows.",
        kind: "reference",
      },
    ],
  },
  {
    id: "routing",
    title: "Routing",
    items: [
      {
        title: "File-Based Routing",
        slug: "routing/file-based-routing",
        description: "Map Bun-native route files to URLs, params, API routes, and markdown pages.",
        kind: "guide",
      },
      {
        title: "Layouts and Groups",
        slug: "routing/layouts-and-groups",
        description: "Compose shared UI, middleware, and route groups without leaking them into the public URL.",
        kind: "guide",
      },
      {
        title: "Middleware",
        slug: "routing/middleware",
        description: "Run global and nested request pipeline logic before loaders, actions, pages, and API handlers.",
        kind: "guide",
      },
      {
        title: "Navigation",
        slug: "routing/navigation",
        description: "Use Link, useRouter, prefetching, route announcers, and soft transitions correctly.",
        kind: "guide",
      },
    ],
  },
  {
    id: "data",
    title: "Data",
    items: [
      {
        title: "Loaders",
        slug: "data/loaders",
        description: "Fetch server data, stream deferred values, and hydrate them back into the client tree.",
        kind: "guide",
      },
      {
        title: "Actions",
        slug: "data/actions",
        description: "Handle mutations, redirects, validation, and post-submit navigation flows.",
        kind: "guide",
      },
      {
        title: "Error Handling",
        slug: "data/error-handling",
        description: "Use TanStack-style caught errors, notFound, boundaries, and route lifecycle hooks.",
        kind: "guide",
      },
    ],
  },
  {
    id: "rendering",
    title: "Rendering",
    items: [
      {
        title: "SSR and Hydration",
        slug: "rendering/ssr-hydration",
        description: "Render full documents on the server while keeping the client tree in sync.",
        kind: "guide",
      },
      {
        title: "Streaming and Deferred",
        slug: "rendering/streaming-deferred",
        description: "Stream HTML and deferred loader chunks for faster time-to-content.",
        kind: "guide",
      },
      {
        title: "Head and Meta",
        slug: "rendering/head-meta",
        description: "Define titles and metadata per route without losing SSR determinism.",
        kind: "guide",
      },
    ],
  },
  {
    id: "styling",
    title: "Styling",
    items: [
      {
        title: "CSS Modules",
        slug: "styling/css-modules",
        description: "Co-locate component styling and bridge framework-emitted markdown classes safely.",
        kind: "guide",
      },
      {
        title: "Global CSS",
        slug: "styling/global-css",
        description: "Keep only truly global tokens, resets, and syntax highlighting in shared CSS.",
        kind: "reference",
      },
      {
        title: "Public Assets",
        slug: "styling/public-assets",
        description: "Serve static images, fonts, and icons with predictable cache and URL behavior.",
        kind: "reference",
      },
    ],
  },
  {
    id: "tooling",
    title: "Tooling",
    items: [
      {
        title: "Dev Server",
        slug: "tooling/dev-server",
        description: "Understand watch mode, hot document reload, transition payloads, and debugging.",
        kind: "reference",
      },
      {
        title: "CLI",
        slug: "tooling/cli",
        description: "Use rbssr commands to scaffold, develop, build, preview, and deploy.",
        kind: "reference",
      },
      {
        title: "Testing",
        slug: "tooling/testing",
        description: "Layer unit, integration, and e2e tests around Bun-native SSR behavior.",
        kind: "reference",
      },
      {
        title: "Build Output",
        slug: "tooling/build-output",
        description: "Inspect the dist output, client assets, route manifest, and server bundles.",
        kind: "reference",
      },
    ],
  },
  {
    id: "deployment",
    title: "Deployment",
    items: [
      {
        title: "Bun Deployment",
        slug: "deployment/bun-deployment",
        description: "Ship the framework with Bun-only runtime assumptions and a minimal production surface.",
        kind: "guide",
      },
      {
        title: "Configuration",
        slug: "deployment/configuration",
        description: "Configure headers, bytecode, ports, and other framework deployment settings.",
        kind: "reference",
      },
      {
        title: "Troubleshooting",
        slug: "deployment/troubleshooting",
        description: "Debug build, hydration, bytecode, fly.io, and Bun runtime deployment issues.",
        kind: "reference",
      },
    ],
  },
  {
    id: "api",
    title: "API",
    items: [
      {
        title: "Overview",
        slug: "api/overview",
        description: "Choose the right entrypoint and jump from concepts to the generated API reference quickly.",
        kind: "reference",
      },
      {
        title: "Bun Runtime APIs",
        slug: "api/bun-runtime-apis",
        description: "Map Bun-native APIs used by the framework to the public docs and runtime surface.",
        kind: "reference",
      },
      {
        title: "react-bun-ssr",
        slug: "api/react-bun-ssr",
        description: "Root-package exports for config, server startup, and shared runtime helpers.",
        kind: "api",
      },
      {
        title: "react-bun-ssr/route",
        slug: "api/react-bun-ssr-route",
        description: "Route-module hooks, types, helpers, and client navigation primitives.",
        kind: "api",
      },
    ],
  },
  {
    id: "migration",
    title: "Migration",
    items: [
      {
        title: "From Demo Template",
        slug: "migration/from-demo-template",
        description: "Move an older demo-style setup onto the docs-first product architecture.",
        kind: "migration",
      },
    ],
  },
];

export function flattenSidebarItems(): Array<SidebarItem & { sectionId: string; sectionTitle: string }> {
  return sidebar.flatMap(section =>
    section.items.map(item => ({
      ...item,
      sectionId: section.id,
      sectionTitle: section.title,
    })),
  );
}

export function flattenSidebarSlugs(): string[] {
  return flattenSidebarItems().map(item => item.slug);
}
