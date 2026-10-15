import { redirect } from "next/navigation";
export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string }>;
}) {
  const { route } = await searchParams;
  redirect(
    `/rides/new?mode=driver${typeof route === "string" && route ? `&route=${encodeURIComponent(route)}` : ""}`,
  );
}
