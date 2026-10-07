import { NewPost } from "../../../src/rides/new-post";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ route?: string }>;
}) {
  const params = await searchParams;
  return (
    <NewPost routeId={typeof params.route === "string" ? params.route : ""} />
  );
}
