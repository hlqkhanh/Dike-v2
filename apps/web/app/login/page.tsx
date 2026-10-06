"use client";
import Link from "next/link";
import { useState } from "react";
import { googleLoginUrl } from "../../src/auth/client";
export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  return (
    <main className="shell auth-shell">
      <Link href="/">Dike</Link>
      <h1>Đăng nhập Dike</h1>
      <p>
        Dùng tài khoản Google để tiếp tục. Nếu lần đăng nhập trước bị hủy hoặc
        thất bại, bạn có thể thử lại.
      </p>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          window.location.assign(googleLoginUrl());
        }}
      >
        {busy ? "Đang chuyển đến Google…" : "Tiếp tục với Google"}
      </button>
      <p>
        Nếu đã có 5 phiên, hãy thu hồi một phiên trên thiết bị đang đăng nhập
        trước khi thử lại.
      </p>
    </main>
  );
}
