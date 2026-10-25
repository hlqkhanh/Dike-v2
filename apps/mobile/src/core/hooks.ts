import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createMobileApi } from "./api";
import { useSession } from "./session";

export function useMobileApi() {
  const { token } = useSession();
  return useMemo(() => createMobileApi(() => Promise.resolve(token)), [token]);
}
export function useResource<T>(key: string, path: string) {
  const api = useMobileApi();
  return useQuery({
    queryKey: ["mobile", key, path],
    queryFn: () => api.call<T>(path),
  });
}
export const dateTime = (date?: string) =>
  date
    ? new Date(date).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Chưa xác định";
export const money = (amount?: number) =>
  `${(amount ?? 0).toLocaleString("vi-VN")} ₫`;
export const statusLabel = (status: string) =>
  ({
    DRAFT: "Bản nháp",
    OPEN: "Đang mở",
    PUBLISHED: "Đang hiển thị",
    ACTIVE: "Đang hoạt động",
    IN_PROGRESS: "Đang di chuyển",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    CLOSED: "Đã đóng",
    PENDING: "Chờ xác nhận",
    ACCEPTED: "Đã xác nhận",
    REJECTED: "Đã từ chối",
    WITHDRAWN: "Đã rút",
    DRIVER_STARTED: "Đang đến đón",
    DRIVER_ARRIVED: "Đã đến đón",
    CONFIRMED: "Đã xác nhận",
    PAUSED: "Tạm dừng",
    FULL: "Đã đủ chỗ",
    EXPIRED: "Đã hết hạn",
    BOARDED: "Đã lên xe",
    NO_SHOW: "Không có mặt",
    ENDED_EARLY: "Kết thúc sớm",
    ENDED: "Đã kết thúc",
  })[status] ?? status;
