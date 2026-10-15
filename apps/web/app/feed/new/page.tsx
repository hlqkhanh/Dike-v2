import { redirect } from "next/navigation";
export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string }>;
}) {
  const { route } = await searchParams;
  redirect(
    `/rides/new?mode=passenger${typeof route === "string" && route ? `&route=${encodeURIComponent(route)}` : ""}`,
  );
}
