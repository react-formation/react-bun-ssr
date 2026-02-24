import { redirect, useLoaderData } from "react-bun-ssr/route";

type ContactData = {
  submitted: boolean;
  name?: string;
};

export function loader({ url }: { url: URL }): ContactData {
  const name = url.searchParams.get("name") ?? undefined;
  return {
    submitted: Boolean(name),
    name,
  };
}

export async function action({ formData }: { formData?: FormData }) {
  const name = String(formData?.get("name") ?? "").trim();
  if (!name) {
    return {
      submitted: false,
    };
  }

  return redirect(`/contact?name=${encodeURIComponent(name)}`, 303);
}

export default function ContactRoute() {
  const data = useLoaderData<ContactData>();

  return (
    <section className="card stack">
      <h1>Action + Redirect Demo</h1>
      <form method="post" className="stack">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" placeholder="Jane Doe" />
        <button type="submit">Submit</button>
      </form>
      {data.submitted && data.name ? <p>Submitted name: {data.name}</p> : null}
      <a href="/">Back home</a>
    </section>
  );
}

export function head() {
  return <title>react-bun-ssr | Contact</title>;
}
