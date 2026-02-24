function payload(name?: string) {
  return {
    message: `Hello, ${name || "world"}!`,
    runtime: "react-bun-ssr",
  };
}

export function GET({ url }: { url: URL }) {
  const name = url.searchParams.get("name") ?? undefined;
  return Response.json(payload(name));
}

export function PUT({ url }: { url: URL }) {
  const name = url.searchParams.get("name") ?? undefined;
  return Response.json({
    ...payload(name),
    method: "PUT",
  });
}
