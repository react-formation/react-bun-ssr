#!/usr/bin/env bun

import {
  runBuild,
  runDev,
  runInit,
  runStart,
  runTest,
  runTypecheck,
} from "./commands";
import { formatCliHelp, resolveCliInvocation } from "./internal";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(formatCliHelp());
}

async function main(argv: string[]): Promise<void> {
  const invocation = resolveCliInvocation(argv);

  switch (invocation.kind) {
    case "command":
      switch (invocation.command) {
        case "init":
          await runInit(invocation.args);
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
          await runTest(invocation.args);
          return;
      }
      return;
    case "help":
      printHelp();
      return;
    case "unknown":
      // eslint-disable-next-line no-console
      console.error(`Unknown command: ${invocation.command}`);
      printHelp();
      process.exit(1);
  }
}

main(process.argv.slice(2)).catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
