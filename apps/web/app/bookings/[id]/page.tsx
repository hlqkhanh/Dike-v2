import { BookingDetail } from "../../../src/rides/detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingDetail id={id} />;
}
