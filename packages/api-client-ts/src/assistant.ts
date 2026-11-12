/** Shared presentation contract for the web and native assistant clients. */
export type DikeAssistantDraft = {
  id: string;
  kind: "INTENT" | "SCHEDULE";
  version: number;
  fields: Record<string, string>;
};
export type DikeAssistantConversation = {
  id: string;
  draft: DikeAssistantDraft | null;
};
export type DikeAssistantReply = {
  text: string;
  draft: DikeAssistantDraft | null;
  source: { id: string; title: string; text: string; action: string } | null;
  bookings: {
    id: string;
    status: string;
    pickupAt: string | null;
    role: string;
  }[];
  checkedAt: string | null;
};
export type DikeAssistantResult = {
  id: string;
  kind: string;
  warnings: string[];
};
export const assistantSuggestions = [
  "Mai 7 giờ sáng đi từ Thủ Đức tới ĐH FPT, cần 1 chỗ",
  "Thứ hai đến thứ sáu đi học tại ĐH FPT, tạo lịch giúp mình",
  "Hướng dẫn: Tạo lịch định kỳ",
  "Hướng dẫn: Đặt chỗ đi cùng",
  "Hướng dẫn: Hủy chuyến hoặc booking",
  "Hướng dẫn: Báo cáo vấn đề",
  "Xem booking của tôi",
] as const;
export const assistantFields: Record<
  string,
  { label: string; type?: "date" | "time" | "number"; options?: string[] }
> = {
  name: { label: "Tên lịch" },
  date: { label: "Ngày đi / bắt đầu", type: "date" },
  until: { label: "Ngày kết thúc", type: "date" },
  role: { label: "Vai trò", options: ["RIDER", "DRIVER"] },
  departureTime: { label: "Giờ xuất phát", type: "time" },
  startTime: { label: "Giờ bắt đầu học/làm", type: "time" },
  endTime: { label: "Giờ kết thúc học/làm", type: "time" },
  weekdays: {
    label: "Ngày lặp trong tuần",
    options: [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ],
  },
  category: { label: "Hoạt động", options: ["STUDY", "WORK", "OTHER"] },
  directions: {
    label: "Chiều di chuyển",
    options: ["OUTBOUND", "RETURN", "OUTBOUND,RETURN"],
  },
  buffer: { label: "Đến sớm (phút)", type: "number" },
};
export function assistantFieldKeys(kind: string) {
  return kind === "SCHEDULE"
    ? [
        "name",
        "date",
        "until",
        "role",
        "startTime",
        "endTime",
        "weekdays",
        "category",
        "directions",
        "buffer",
      ]
    : ["date", "role", "departureTime"];
}
export const assistantOptionLabels: Record<string, string> = {
  MONDAY: "Thứ hai",
  TUESDAY: "Thứ ba",
  WEDNESDAY: "Thứ tư",
  THURSDAY: "Thứ năm",
  FRIDAY: "Thứ sáu",
  SATURDAY: "Thứ bảy",
  SUNDAY: "Chủ nhật",
  RIDER: "Người đi ké",
  DRIVER: "Tài xế",
  STUDY: "Đi học",
  WORK: "Đi làm",
  OTHER: "Khác",
  OUTBOUND: "Chiều đi",
  RETURN: "Chiều về",
  "OUTBOUND,RETURN": "Cả đi và về",
};
