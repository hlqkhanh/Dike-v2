import { PageHeader } from "../components/app-ui";
import { InboxContent } from "./inbox-content";

export default function InboxPage() {
  return (
    <main className="settings-page inbox-page">
      <PageHeader
        eyebrow="Kết nối an toàn"
        title="Tin nhắn"
        description="Trao đổi điểm đón, thời gian và chi tiết chuyến đi với người đồng hành."
      />
      <InboxContent />
    </main>
  );
}
