import { ApiListScreen } from "@/components/ApiListScreen";
export default function Discover() {
  return (
    <ApiListScreen
      load={(api) => api.feed()}
      queryKey="feed"
      subtitle="Nhu cầu và chuyến đi phù hợp với bạn"
      title="Khám phá"
    />
  );
}
