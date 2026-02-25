import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import { compileMarkdownRouteModule } from "../../framework/runtime/markdown-routes";

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rbssr-md-routes-"));
  tempDirs.push(dir);
  return dir;
}

describe("compileMarkdownRouteModule", () => {
  it("compiles markdown to a TSX wrapper module", () => {
    const root = makeTempDir();
    const routesDir = path.join(root, "app", "routes");
    fs.mkdirSync(routesDir, { recursive: true });

    const markdownFile = path.join(routesDir, "guide.md");
    fs.writeFileSync(
      markdownFile,
      "---\n"
        + "title: Guide\n"
        + "description: Guide description\n"
        + "section: Guides\n"
        + "order: 1\n"
        + "tags: markdown,test\n"
        + "---\n\n"
        + "# Guide\n\nHello **framework**\n\n```ts\nconst value = 1;\n```\n",
      "utf8",
    );

    const outputPath = compileMarkdownRouteModule({
      routesDir,
      sourceFilePath: markdownFile,
      generatedMarkdownRootDir: path.join(root, ".generated"),
    });

    const output = fs.readFileSync(outputPath, "utf8");
    expect(outputPath.endsWith(".tsx")).toBe(true);
    expect(output).toContain("dangerouslySetInnerHTML");
    expect(output).toContain("className=\"docs-hero\"");
    expect(output).toContain("const markdownTitle = \"Guide\"");
    expect(output).toContain("token keyword");
  });

  it("invalidates generated output when markdown content changes", () => {
    const root = makeTempDir();
    const routesDir = path.join(root, "app", "routes");
    fs.mkdirSync(routesDir, { recursive: true });

    const markdownFile = path.join(routesDir, "guide.md");
    fs.writeFileSync(markdownFile, "# Guide\n\nOriginal", "utf8");

    const generatedMarkdownRootDir = path.join(root, ".generated");
    const firstOutputPath = compileMarkdownRouteModule({
      routesDir,
      sourceFilePath: markdownFile,
      generatedMarkdownRootDir,
    });
    const firstOutput = fs.readFileSync(firstOutputPath, "utf8");
    expect(firstOutput).toContain("Original");

    fs.writeFileSync(markdownFile, "# Guide\n\nUpdated", "utf8");

    const secondOutputPath = compileMarkdownRouteModule({
      routesDir,
      sourceFilePath: markdownFile,
      generatedMarkdownRootDir,
    });
    const secondOutput = fs.readFileSync(secondOutputPath, "utf8");

    expect(secondOutputPath).toBe(firstOutputPath);
    expect(secondOutput).toContain("Updated");
    expect(secondOutput).not.toBe(firstOutput);
  });
});
