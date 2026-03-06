import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { nodeSignature } from "../../../framework/runtime/head-reconcile";

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

function firstHeadNode(headHtml: string): Node {
  const documentRef = new DOMParser().parseFromString(
    `<!doctype html><html><head>${headHtml}</head><body></body></html>`,
    "text/html",
  );
  const node = documentRef.head.firstChild;
  if (!node) {
    throw new Error("Missing head node in fixture");
  }
  return node;
}

function firstBodyNode(bodyHtml: string): Node {
  const documentRef = new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${bodyHtml}</body></html>`,
    "text/html",
  );
  const node = documentRef.body.firstChild;
  if (!node) {
    throw new Error("Missing body node in fixture");
  }
  return node;
}

describe("managed head node signatures", () => {
  it("ignores inner text formatting differences for script nodes", () => {
    const scriptA = firstHeadNode('<script type="application/ld+json">{ "a": 1 }</script>');
    const scriptB = firstHeadNode('<script type="application/ld+json">\n{   "a":1 }\n</script>');

    expect(nodeSignature(scriptA)).toBe(nodeSignature(scriptB));
  });

  it("distinguishes meta and title changes through attributes/text", () => {
    const metaA = firstHeadNode('<meta name="description" content="alpha">');
    const metaB = firstHeadNode('<meta name="description" content="beta">');
    const titleA = firstHeadNode("<title>Docs Home</title>");
    const titleB = firstHeadNode("<title>Docs API</title>");

    expect(nodeSignature(metaA)).not.toBe(nodeSignature(metaB));
    expect(nodeSignature(titleA)).not.toBe(nodeSignature(titleB));
  });

  it("does not rely on raw innerHTML for arbitrary element identity", () => {
    const divA = firstBodyNode('<div data-slot="hero"><span>Hi</span></div>');
    const divB = firstBodyNode('<div data-slot="hero">\n  <span>Hi</span>\n</div>');
    const signature = nodeSignature(divA);

    expect(signature).toBe(nodeSignature(divB));
    expect(signature.includes("<span>")).toBe(false);
  });

  it("keeps text and comment signatures stable", () => {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><head></head><body></body></html>",
      "text/html",
    );
    expect(nodeSignature(doc.createTextNode("alpha"))).toBe("text:alpha");
    expect(nodeSignature(doc.createComment("beta"))).toBe("comment:beta");
  });
});
