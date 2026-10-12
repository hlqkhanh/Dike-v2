import Link from "next/link";
import { DikeLogo } from "../components/dike-logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="login-stage-viewport">
      {/* Top Left Brand Logo */}
      <header className="login-stage-header">
        <Link
          className="login-brand"
          href="/"
          aria-label="Diké Share — Trang chủ"
        >
          <DikeLogo className="login-brand-logo" />
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="login-stage-main">
        <div className="login-content-box">
          <p className="login-greeting">Chào bạn,</p>
          <h1 className="login-title">Đăng nhập Diké Share</h1>
          <p className="login-subtitle">
            Tiếp tục hành trình di chuyển xanh cùng chúng tôi.
          </p>

          {error ? (
            <div className="login-error-alert" role="alert">
              <span aria-hidden="true">⚠️</span>
              <p>Không thể đăng nhập. Vui lòng thử lại.</p>
            </div>
          ) : null}

          {/* Google Login Button */}
          <a
            className="login-google-btn"
            href="/api/v1/auth/google"
            id="google-login-button"
            aria-label="Đăng nhập với Google"
          >
            <svg
              className="google-icon"
              viewBox="0 0 24 24"
              width="22"
              height="22"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="google-text">Đăng nhập với Google</span>
          </a>

          {/* Divider */}
          <div className="login-divider" aria-hidden="true">
            <span>hoặc</span>
          </div>

          {/* Register Link */}
          <p className="login-footer">
            Chưa có tài khoản?{" "}
            <Link className="login-signup-link" href="/onboarding">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
