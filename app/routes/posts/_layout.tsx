import { Outlet } from 'react-bun-ssr/route';

export default function PostsLayout() {
  return (
    <section className="card stack">
      <h2>Posts Section Layout wesh</h2>
      <Outlet />
    </section>
  );
}
