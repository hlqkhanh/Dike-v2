import { Card } from "@dike/web-ui";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Link className="brand" href="/" aria-label="Dike — Trang đầu">
          <span className="brand__mark" aria-hidden="true">
            D
          </span>
          <span>Dike</span>
        </Link>
        <p className="eyebrow">Đăng nhập an toàn</p>
        <h1>Tiếp tục hành trình của bạn.</h1>
        <p className="auth-copy">
          Dike dùng Google để xác minh danh tính ban đầu. Google token không
          được lưu trong trình duyệt.
        </p>
        {error ? (
          <p className="auth-error" role="alert">
            Không thể đăng nhập. Vui lòng thử lại.
          </p>
        ) : null}
        <a className="auth-action" href="/api/v1/auth/google">
          Tiếp tục với Google
        </a>
      </Card>
    </main>
  );
}
