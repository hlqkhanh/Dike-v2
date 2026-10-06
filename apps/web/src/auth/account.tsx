"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { SessionView, DeviceView } from "@dike/api-client-ts";
import {
  authRequest,
  authMessage,
  AuthError,
  refreshSession,
  clearAuth,
} from "./client";
export function Account({ devices = false }: { devices?: boolean }) {
  const [session, setSession] = useState<SessionView>();
  const [sessions, setSessions] = useState<DeviceView[]>([]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    try {
      const value = await authRequest("getSession");
      setSession(value);
      setError("");
      if (devices) setSessions(await authRequest("listSessions"));
    } catch (e) {
      setSession(undefined);
      setSessions([]);
      setError(authMessage(e));
      if (e instanceof AuthError && e.status === 401)
        window.location.replace("/login");
    }
  }, [devices]);
  useEffect(() => {
    const reload = () => {
      void load();
    };
    reload();
    window.addEventListener("focus", reload);
    window.addEventListener("pageshow", reload);
    const channel = new BroadcastChannel("dike-auth");
    channel.onmessage = () => {
      clearAuth();
      setSession(undefined);
      setSessions([]);
      reload();
    };
    return () => {
      channel.close();
      window.removeEventListener("focus", reload);
      window.removeEventListener("pageshow", reload);
    };
  }, [load]);
  async function run(action: () => Promise<unknown>, logout = false) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await action();
      const channel = new BroadcastChannel("dike-auth");
      channel.postMessage("changed");
      channel.close();
      if (logout) {
        setSession(undefined);
        setSessions([]);
        window.location.replace("/login");
      } else {
        setSaved(true);
        await load();
      }
    } catch (e) {
      setError(authMessage(e));
      if (e instanceof AuthError && e.status === 401) {
        clearAuth();
        setSession(undefined);
        setSessions([]);
        window.location.replace("/login");
      }
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => authRequest("updatePhone", { body: { phone } }));
  }
  return (
    <main className="shell auth-shell">
      <Link href="/">Dike</Link>
      <h1>{devices ? "Thiết bị đăng nhập" : "Số điện thoại của bạn"}</h1>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => void load()}>Thử tải lại</button>
        </div>
      )}
      {!session && !error && <p role="status">Đang kiểm tra phiên…</p>}
      {session && (
        <>
          <p>Xin chào {session.user?.displayName}</p>
          {!devices ? (
            <form onSubmit={submit} className="auth-form">
              <p>
                Số điện thoại được lưu ở trạng thái chưa xác minh. Xác minh OTP
                sẽ có ở Stage 3.
              </p>
              <p>
                Trạng thái hiện tại:{" "}
                {session.user?.phoneStatus === "UNVERIFIED"
                  ? "Chưa xác minh"
                  : "Chưa nhập số"}
              </p>
              <label htmlFor="phone">Số di động Việt Nam</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={32}
                value={phone}
                placeholder="09xxxxxxxx"
                onChange={(event) => setPhone(event.target.value)}
                disabled={busy}
              />
              <button disabled={busy} type="submit">
                {busy ? "Đang lưu…" : "Lưu số điện thoại"}
              </button>
              <a href="/account/sessions">Quản lý phiên đăng nhập</a>
            </form>
          ) : (
            <>
              <p>
                Mỗi tài khoản tối đa 5 phiên. Phiên nghỉ quá 30 phút hoặc đã tồn
                tại 7 ngày cần đăng nhập lại.
              </p>
              <ul>
                {sessions.map((s) => (
                  <li key={s.deviceSessionId}>
                    <p>
                      {s.current ? "Phiên hiện tại" : "Phiên khác"} · Hoạt động:{" "}
                      {new Date((s.lastSeenAt ?? 0) * 1000).toLocaleString(
                        "vi-VN",
                      )}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Đăng xuất thiết bị này?"))
                          void run(
                            () =>
                              authRequest("revokeSession", {
                                path: { deviceSessionId: s.deviceSessionId },
                              }),
                            !!s.current,
                          );
                      }}
                    >
                      Thu hồi phiên
                    </button>
                  </li>
                ))}
              </ul>
              <button disabled={busy} onClick={() => void run(refreshSession)}>
                Làm mới phiên
              </button>
              <button
                disabled={busy}
                onClick={() => void run(() => authRequest("logout"), true)}
              >
                Đăng xuất
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Đăng xuất tất cả thiết bị?"))
                    void run(() => authRequest("logoutAll"), true);
                }}
              >
                Đăng xuất tất cả
              </button>
              <p>
                <a href="/onboarding/phone">Cập nhật số điện thoại</a>
              </p>
            </>
          )}
          {saved && <p role="status">Đã cập nhật thành công.</p>}
        </>
      )}
    </main>
  );
}
