import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { replaceManagedHead } from "../../../framework/runtime/head-reconcile";
import {
  RBSSR_HEAD_MARKER_END_ATTR,
  RBSSR_HEAD_MARKER_START_ATTR,
} from "../../../framework/runtime/runtime-constants";

beforeAll(() => {
  GlobalRegistrator.register({
    url: "http://localhost/",
    settings: {
      disableCSSFileLoading: true,
      handleDisabledFileLoadingAsSuccess: true,
    },
  });
});

afterAll(async () => {
  if (GlobalRegistrator.isRegistered) {
    await GlobalRegistrator.unregister();
  }
});

function createDocumentWithManagedHead(): Document {
  return new DOMParser().parseFromString(
    `<!doctype html>
    <html>
      <head>
        <meta ${RBSSR_HEAD_MARKER_START_ATTR}="1">
        <title>Old title</title>
        <script type="application/ld+json" data-schema="1">
          { "name": "Docs", "version": 1 }
        </script>
        <meta name="description" content="old">
        <link rel="stylesheet" href="/shared.css">
        <meta ${RBSSR_HEAD_MARKER_END_ATTR}="1">
      </head>
      <body></body>
    </html>`,
    "text/html",
  );
}

describe("managed head reconciliation", () => {
  it("reuses script nodes when only inline text formatting changes and updates managed order", async () => {
    const documentRef = createDocumentWithManagedHead();
    const existingStylesheet = documentRef.head.querySelector('link[rel="stylesheet"][href="/shared.css"]');
    expect(existingStylesheet).toBeTruthy();
    // Happy DOM does not emit stylesheet load events; mark as already loaded.
    Object.defineProperty(existingStylesheet as HTMLLinkElement, "sheet", {
      configurable: true,
      get() {
        return {};
      },
    });
    const beforeScript = documentRef.head.querySelector("script[data-schema='1']");
    expect(beforeScript).toBeTruthy();

    await replaceManagedHead(
      `
      <title>New title</title>
      <script type="application/ld+json" data-schema="1">{"name":"Docs","version":1}</script>
      <meta name="description" content="new">
      <link rel="stylesheet" href="/shared.css">
      `,
      { documentRef },
    );

    const afterScript = documentRef.head.querySelector("script[data-schema='1']");
    const title = documentRef.head.querySelector("title");
    const description = documentRef.head.querySelector('meta[name="description"]');
    const stylesheetHrefs = Array.from(
      documentRef.head.querySelectorAll('link[rel="stylesheet"][href]'),
    ).map(link => link.getAttribute("href"));

    expect(afterScript).toBe(beforeScript);
    expect(title?.textContent).toBe("New title");
    expect(description?.getAttribute("content")).toBe("new");
    expect(stylesheetHrefs).toEqual(["/shared.css"]);
    expect(new Set(stylesheetHrefs).size).toBe(stylesheetHrefs.length);
  });
});
