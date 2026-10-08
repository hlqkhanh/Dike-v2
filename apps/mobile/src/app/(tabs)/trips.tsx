import { ApiListScreen } from "@/components/ApiListScreen";
export default function Trips() {
  return (
    <ApiListScreen
      load={async (api) => [
        ...(await api.trips()).items,
        ...(await api.bookings()).items,
      ]}
      queryKey="trips"
      subtitle="Chuyến đã tạo và booking đang tham gia"
      title="Chuyến của tôi"
    />
  );
}
