import path from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import { ensureDir, makeTempDir, removePath } from "../../framework/runtime/io";
import { compileMarkdownRouteModule } from "../../framework/runtime/markdown-routes";

const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await removePath(dir);
  }
});

async function createTempDir(): Promise<string> {
  const dir = await makeTempDir("rbssr-md-routes");
  tempDirs.push(dir);
  return dir;
}

describe("compileMarkdownRouteModule", () => {
  it("compiles markdown to a TSX wrapper module", async () => {
    const root = await createTempDir();
    const routesDir = path.join(root, "app", "routes");
    await ensureDir(routesDir);

    const markdownFile = path.join(routesDir, "guide.md");
    await Bun.write(
      markdownFile,
      "---\n"
        + "title: Guide\n"
        + "description: Guide description\n"
        + "section: Guides\n"
        + "order: 1\n"
        + "tags: markdown,test\n"
        + "---\n\n"
        + "# Guide\n\nHello **framework**\n\n```ts\nconst value = 1;\n```\n",
    );

    const outputPath = await compileMarkdownRouteModule({
      routesDir,
      sourceFilePath: markdownFile,
      generatedMarkdownRootDir: path.join(root, ".generated"),
    });

    const output = await Bun.file(outputPath).text();
    expect(outputPath.endsWith(".tsx")).toBe(true);
    expect(output).toContain("dangerouslySetInnerHTML");
    expect(output).toContain("className=\"docs-hero\"");
    expect(output).toContain("const markdownTitle = \"Guide\"");
    expect(output).toContain("token keyword");
  });

  it("invalidates generated output when markdown content changes", async () => {
    const root = await createTempDir();
    const routesDir = path.join(root, "app", "routes");
    await ensureDir(routesDir);

    const markdownFile = path.join(routesDir, "guide.md");
    await Bun.write(markdownFile, "# Guide\n\nOriginal");

    const generatedMarkdownRootDir = path.join(root, ".generated");
    const firstOutputPath = await compileMarkdownRouteModule({
      routesDir,
      sourceFilePath: markdownFile,
      generatedMarkdownRootDir,
    });
    const firstOutput = await Bun.file(firstOutputPath).text();
    expect(firstOutput).toContain("Original");

    await Bun.write(markdownFile, "# Guide\n\nUpdated");

    const secondOutputPath = await compileMarkdownRouteModule({
      routesDir,
      sourceFilePath: markdownFile,
      generatedMarkdownRootDir,
    });
    const secondOutput = await Bun.file(secondOutputPath).text();

    expect(secondOutputPath).toBe(firstOutputPath);
    expect(secondOutput).toContain("Updated");
    expect(secondOutput).not.toBe(firstOutput);
  });

  it("strips blog frontmatter without requiring docs-only fields", async () => {
    const root = await createTempDir();
    const routesDir = path.join(root, "app", "routes");
    await ensureDir(routesDir);

    const markdownFile = path.join(routesDir, "blog-post.md");
    await Bun.write(
      markdownFile,
      "---\n"
        + "title: Blog Post\n"
        + "description: Post description\n"
        + "section: Blog\n"
        + "author: gaudiauj\n"
        + "publishedAt: 2026-03-01\n"
        + "tags: bun,ssr\n"
        + "---\n\n"
        + "# Blog Post\n\nLaunch content.\n",
    );

    const outputPath = await compileMarkdownRouteModule({
      routesDir,
      sourceFilePath: markdownFile,
      generatedMarkdownRootDir: path.join(root, ".generated"),
    });

    const output = await Bun.file(outputPath).text();
    expect(output).toContain("const markdownTitle = \"Blog Post\"");
    expect(output).toContain("Launch content.");
    expect(output).not.toContain("publishedAt: 2026-03-01");
    expect(output).not.toContain("<hr />");
  });
});
