import { PostDetail } from "../../../src/rides/detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetail id={decodeURIComponent(id)} />;
}
