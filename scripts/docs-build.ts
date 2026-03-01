import { writeDocsManifest } from "./build-docs-manifest.ts";
import { writeBlogManifest } from "./build-blog-manifest.ts";
import { writeSearchIndex } from "./build-search-index.ts";
import { writeSitemap } from "./build-sitemap.ts";
import { generateApiDocs } from "./generate-api-docs.ts";

async function main(): Promise<void> {
  await generateApiDocs();
  await writeDocsManifest();
  await writeSearchIndex();
  await writeBlogManifest();
  await writeSitemap();
  const subprocess = Bun.spawnSync({
    cmd: ["bun", "bin/rbssr.ts", "build"],
    stdout: "inherit",
    stderr: "inherit",
  });
  if (subprocess.exitCode !== 0) {
    throw new Error(`rbssr build failed with exit code ${subprocess.exitCode}`);
  }
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
