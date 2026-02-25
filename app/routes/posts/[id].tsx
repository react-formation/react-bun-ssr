import { useLoaderData, useParams } from 'react-bun-ssr/route';

type PostData = {
  title: string;
  slug: string;
};

export function loader({
  params,
}: {
  params: Record<string, string>;
}): PostData {
  const slug = params.id ?? 'unknown';
  return {
    title: `Post: ${slug}`,
    slug,
  };
}

export default function PostRoute() {
  const data = useLoaderData<PostData>();
  const params = useParams();

  return (
    <section className="card stack">
      <h1>{data.title}</h1>
      <p>Dynamic param = {params.id}</p>
      <p>
        <a href="/">Back home</a>
      </p>
    </section>
  );
}

export function head({ params }: { params: Record<string, string> }) {
  return <title>{`Post ${params.id ?? ''}`}</title>;
}
