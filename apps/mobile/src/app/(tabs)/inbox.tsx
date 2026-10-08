import { ApiListScreen } from "@/components/ApiListScreen";
export default function Inbox() {
  return (
    <ApiListScreen
      load={(api) => api.conversations()}
      queryKey="inbox"
      subtitle="Tin nhắn và cập nhật hành trình"
      title="Hộp thư"
    />
  );
}
