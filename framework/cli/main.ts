#!/usr/bin/env bun

import {
  runBuild,
  runDev,
  runInit,
  runStart,
  runTest,
  runTypecheck,
} from "./commands";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`rbssr commands:
  rbssr init [--force]
  rbssr dev
  rbssr build
  rbssr start
  rbssr typecheck
  rbssr test [bun-test-args]
`);
}

async function main(argv: string[]): Promise<void> {
  const [command = "help", ...rest] = argv;

  switch (command) {
    case "init":
      await runInit(rest);
      return;
    case "dev":
      await runDev();
      return;
    case "build":
      await runBuild();
      return;
    case "start":
      await runStart();
      return;
    case "typecheck":
      await runTypecheck();
      return;
    case "test":
      await runTest(rest);
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    default:
      // eslint-disable-next-line no-console
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main(process.argv.slice(2)).catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
