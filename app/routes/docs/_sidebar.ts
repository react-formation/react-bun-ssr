export interface SidebarItem {
  title: string;
  slug: string;
  tags?: string[];
}

export interface SidebarSection {
  section: string;
  items: SidebarItem[];
}

export const sidebar: SidebarSection[] = [
  {
    section: "Getting Started",
    items: [
      { title: "Introduction", slug: "getting-started/introduction" },
      { title: "Installation", slug: "getting-started/installation" },
      { title: "First app", slug: "getting-started/first-app" },
      { title: "Project structure", slug: "getting-started/project-structure" },
      { title: "Dev/build/start lifecycle", slug: "getting-started/lifecycle" },
    ],
  },
  {
    section: "Core Concepts",
    items: [
      { title: "Routing model", slug: "core-concepts/routing-model" },
      { title: "Nested layouts and route groups", slug: "core-concepts/layouts-and-groups" },
      { title: "Loaders and data flow", slug: "core-concepts/loaders" },
      { title: "Actions and mutation flow", slug: "core-concepts/actions" },
      { title: "Middleware chain", slug: "core-concepts/middleware" },
    ],
  },
  {
    section: "Rendering",
    items: [
      { title: "SSR and hydration", slug: "rendering/ssr-hydration" },
      { title: "Error boundaries and not-found", slug: "rendering/error-and-not-found" },
      { title: "Head and meta", slug: "rendering/head-and-meta" },
      { title: "Dev reload model", slug: "rendering/dev-reload" },
    ],
  },
  {
    section: "Styling and Assets",
    items: [
      { title: "Global CSS", slug: "styling-assets/global-css" },
      { title: "CSS Modules", slug: "styling-assets/css-modules" },
      { title: "Public assets", slug: "styling-assets/public-assets" },
    ],
  },
  {
    section: "API Reference",
    items: [
      { title: "Overview", slug: "api-reference/overview" },
      { title: "react-bun-ssr", slug: "api/react-bun-ssr" },
      { title: "react-bun-ssr/route", slug: "api/react-bun-ssr-route" },
    ],
  },
  {
    section: "Tooling",
    items: [
      { title: "CLI commands", slug: "tooling/cli-commands" },
      { title: "Build artifacts", slug: "tooling/build-artifacts" },
      { title: "Testing strategy", slug: "tooling/testing" },
    ],
  },
  {
    section: "Deployment",
    items: [
      { title: "Bun-only deployment", slug: "deployment/bun-deployment" },
      { title: "Environment configuration", slug: "deployment/environment" },
      { title: "Troubleshooting", slug: "deployment/troubleshooting" },
    ],
  },
  {
    section: "Migration",
    items: [
      { title: "From demo template", slug: "migration/from-demo-template" },
    ],
  },
];

export function flattenSidebarSlugs(): string[] {
  return sidebar.flatMap(section => section.items.map(item => item.slug));
}
