import {
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "../components/app-ui";

const sections = [
  {
    href: "/profile",
    title: "Hồ sơ cá nhân",
    description: "Tên hiển thị, ảnh đại diện và giới thiệu.",
    icon: UserRound,
  },
  {
    href: "/settings/privacy",
    title: "Quyền riêng tư",
    description: "Khả năng tìm thấy, xem hồ sơ và nhắn tin.",
    icon: SlidersHorizontal,
  },
  {
    href: "/settings/consent",
    title: "Đồng ý và tài liệu",
    description: "Điều khoản, quyền riêng tư và lịch sử chấp thuận.",
    icon: FileCheck2,
  },
  {
    href: "/verification",
    title: "Xác minh",
    description: "Theo dõi các bước mở quyền thành viên và tài xế.",
    icon: ShieldCheck,
  },
  {
    href: "/account/sessions",
    title: "Thiết bị đăng nhập",
    description: "Xem và thu hồi các phiên đang hoạt động.",
    icon: LockKeyhole,
  },
  {
    href: "/settings/account",
    title: "Quản lý tài khoản",
    description: "Thông tin về yêu cầu xóa tài khoản.",
    icon: UserRound,
  },
] as const;

export default function SettingsPage() {
  return (
    <main className="settings-page settings-hub">
      <PageHeader
        eyebrow="Trung tâm tài khoản"
        title="Cài đặt"
        description="Quản lý hồ sơ, quyền riêng tư, bảo mật và trạng thái xác minh tại một nơi."
      />
      <div className="settings-hub-grid">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link className="settings-hub-card" href={href} key={href}>
            <span>
              <Icon aria-hidden="true" size={22} />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
