export function GET({ params }: { params: Record<string, string> }) {
  return Response.json({
    message: `Hello, ${params.name}!`,
  });
}
