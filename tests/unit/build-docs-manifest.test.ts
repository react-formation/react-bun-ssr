import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { makeTempDir, removePath, writeText } from "../../framework/runtime/io";
import { buildDocsManifest } from "../../scripts/build-docs-manifest";
import type { SidebarSection } from "../../app/routes/docs/_sidebar";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => removePath(dir)));
});

describe("buildDocsManifest", () => {
  it("extracts heading ids from rendered markdown and computes prev/next order", async () => {
    const docsDir = await makeTempDir("docs-manifest-test");
    tempDirs.push(docsDir);

    await writeText(
      path.join(docsDir, "start/overview.md"),
      `---\ntitle: Overview\nnavTitle: Overview\ndescription: Intro\nsection: Start\norder: 1\nkind: overview\n---\n\n# Overview\n\n## First section\n\nBody`,
    );
    await writeText(
      path.join(docsDir, "start/installation.md"),
      `---\ntitle: Installation\nnavTitle: Installation\ndescription: Install\nsection: Start\norder: 2\nkind: guide\n---\n\n# Installation\n\n## Second step\n\nBody`,
    );

    const sidebarData: SidebarSection[] = [
      {
        id: "start",
        title: "Start",
        items: [
          {
            title: "Overview",
            slug: "start/overview",
            description: "Intro",
            kind: "overview",
          },
          {
            title: "Installation",
            slug: "start/installation",
            description: "Install",
            kind: "guide",
          },
        ],
      },
    ];

    const manifest = await buildDocsManifest({ docsDir, sidebarData });

    expect(manifest[0]?.headings).toEqual([
      { text: "First section", id: "first-section", depth: 2 },
    ]);
    expect(manifest[0]?.nextSlug).toBe("start/installation");
    expect(manifest[1]?.prevSlug).toBe("start/overview");
  });
});
