import { Card } from "@dike/web-ui";
import { ArrowLeft, ArrowRight, Leaf, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { DikeLogo } from "../components/dike-logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-page auth-page--split">
      <section className="auth-story" aria-label="Giới thiệu Diké Share">
        <Link className="auth-home-link" href="/">
          <ArrowLeft aria-hidden="true" size={17} /> Trang chủ
        </Link>
        <div className="auth-story-copy">
          <p className="app-eyebrow">Di chuyển cùng cộng đồng</p>
          <h2>
            Mỗi chuyến đi,
            <br />
            thêm một kết nối xanh.
          </h2>
          <p>
            Gặp người đồng hành phù hợp, chia sẻ chi phí và giảm dấu chân carbon
            trong từng hành trình.
          </p>
          <div className="auth-benefits">
            <span>
              <Users aria-hidden="true" size={18} /> Cộng đồng đã xác minh
            </span>
            <span>
              <ShieldCheck aria-hidden="true" size={18} /> Quyền riêng tư chủ
              động
            </span>
            <span>
              <Leaf aria-hidden="true" size={18} /> Hành trình bền vững
            </span>
          </div>
        </div>
      </section>
      <Card className="auth-card auth-card--product">
        <Link className="brand" href="/" aria-label="Diké Share — Trang đầu">
          <DikeLogo />
        </Link>
        <div>
          <p className="app-eyebrow">Chào mừng trở lại</p>
          <h1>Tiếp tục hành trình của bạn</h1>
          <p className="auth-copy">
            Đăng nhập để quản lý chuyến đi, trò chuyện với bạn đồng hành và xem
            các gợi ý dành riêng cho bạn.
          </p>
        </div>
        {error ? (
          <p className="auth-error" role="alert">
            Không thể đăng nhập. Vui lòng thử lại.
          </p>
        ) : null}
        <a
          className="auth-action auth-google-button"
          href="/api/v1/auth/google"
        >
          <span className="google-mark" aria-hidden="true">
            G
          </span>
          Tiếp tục với Google
          <ArrowRight aria-hidden="true" size={18} />
        </a>
        <div className="auth-trust-note">
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            <strong>Đăng nhập an toàn</strong>
            <span>
              Diké chỉ dùng Google để xác minh danh tính. Token đăng nhập không
              được lưu trong trình duyệt.
            </span>
          </p>
        </div>
        <p className="auth-terms">
          Bằng việc tiếp tục, bạn đồng ý với{" "}
          <Link href="/settings/privacy">chính sách quyền riêng tư</Link> của
          Diké Share.
        </p>
      </Card>
    </main>
  );
}
