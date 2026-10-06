"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, type OtpChallenge } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Input } from "@dike/web-ui";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { z } from "zod";

import { authApi } from "../../../src/auth/api";
import { useAuthFailure } from "../../../src/auth/use-auth-failure";

const schema = z.object({
  phoneNumber: z.string().trim().min(9, "Nhập số điện thoại hợp lệ").max(32),
});
type FormValues = z.infer<typeof schema>;

export default function PhoneOnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<OtpChallenge>();
  const [code, setCode] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const submit = useMutation({
    mutationFn: async ({ phoneNumber }: FormValues) => {
      const updated = await authApi.submitPhone(
        phoneNumber,
        session.data?.user.phoneVersion ?? 0,
      );
      queryClient.setQueryData(["auth", "session"], updated);
      return authApi.issueOtp(updated.user.phoneVersion, crypto.randomUUID());
    },
    onSuccess: (created) => {
      setChallenge(created);
      rememberChallenge(created.challengeId);
    },
  });
  const status = useQuery({
    queryKey: ["auth", "otp", challenge?.challengeId],
    queryFn: () => authApi.otpStatus(challenge!.challengeId),
    enabled: Boolean(challenge?.challengeId),
    refetchInterval: 15_000,
  });
  const resend = useMutation({
    mutationFn: () =>
      authApi.issueOtp(
        session.data?.user.phoneVersion ?? 0,
        crypto.randomUUID(),
      ),
    onSuccess: (created) => {
      setChallenge(created);
      setCode("");
      rememberChallenge(created.challengeId);
    },
  });
  const cancel = useMutation({
    mutationFn: () => authApi.cancelOtp(challenge!.challengeId),
    onSettled: () => {
      setChallenge(undefined);
      setCode("");
      rememberChallenge(undefined);
    },
  });
  const verify = useMutation({
    mutationFn: () =>
      authApi.verifyOtp(challenge!.challengeId, code, crypto.randomUUID()),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["auth", "session"], updated);
      await router.replace("/");
    },
  });
  useAuthFailure(submit.error);
  useAuthFailure(verify.error);
  useAuthFailure(resend.error);
  useAuthFailure(cancel.error);

  useEffect(() => {
    const challengeId = new URLSearchParams(window.location.search).get(
      "challenge",
    );
    const restore = window.setTimeout(() => {
      if (!challengeId) return;
      const current = new Date().toISOString();
      setChallenge({
        challengeId,
        status: "UNKNOWN",
        expiresAt: current,
        resendAfter: current,
      });
    }, 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearTimeout(restore);
      window.clearInterval(timer);
    };
  }, []);

  const activeChallenge = status.data ?? challenge;
  const resendSeconds = activeChallenge
    ? Math.max(
        0,
        Math.ceil((Date.parse(activeChallenge.resendAfter) - now) / 1_000),
      )
    : 0;
  const submitError =
    submit.error instanceof ApiError ? submit.error : undefined;
  const otpError =
    verify.error instanceof ApiError
      ? verify.error
      : resend.error instanceof ApiError
        ? resend.error
        : undefined;

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <p className="eyebrow">Xác minh thử nghiệm</p>
        <h1>{challenge ? "Nhập mã xác minh" : "Thêm số điện thoại"}</h1>
        <p className="auth-copy">
          {challenge
            ? "Nhập mã 6 chữ số mới nhất đã được gửi đến số của bạn."
            : "Số điện thoại chỉ được xác minh sau khi nhập đúng mã OTP."}
        </p>
        {!challenge ? (
          <form onSubmit={form.handleSubmit((values) => submit.mutate(values))}>
            <Input
              label="Số điện thoại Việt Nam"
              autoComplete="tel"
              inputMode="tel"
              placeholder="0901 234 567"
              error={form.formState.errors.phoneNumber?.message}
              {...form.register("phoneNumber")}
            />
            {submitError?.code === "REAUTH_REQUIRED" ? (
              <p className="auth-error" role="alert">
                Bạn cần đăng nhập lại bằng Google trước khi đổi số.{" "}
                <a href="/api/v1/auth/google">Đăng nhập lại</a>
              </p>
            ) : submit.isError ? (
              <p className="auth-error" role="alert">
                Không thể lưu số điện thoại. Hãy kiểm tra và thử lại.
              </p>
            ) : null}
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Đang gửi…" : "Gửi mã"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              verify.mutate();
            }}
          >
            <Input
              label="Mã xác minh"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
            />
            {verify.isError || resend.isError ? (
              <p className="auth-error" role="alert">
                {otpError?.code === "OTP_RATE_LIMITED"
                  ? `Đã có quá nhiều yêu cầu. Thử lại sau ${otpError.retryAfterSeconds ?? resendSeconds} giây.`
                  : "Mã không hợp lệ hoặc đã hết hạn."}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={verify.isPending || code.length !== 6}
            >
              {verify.isPending ? "Đang xác minh…" : "Xác minh"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={resend.isPending || resendSeconds > 0}
              onClick={() => resend.mutate()}
            >
              {resend.isPending
                ? "Đang gửi lại…"
                : resendSeconds > 0
                  ? `Gửi lại sau ${resendSeconds}s`
                  : "Gửi lại mã"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Đổi số điện thoại
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}

function rememberChallenge(challengeId: string | undefined) {
  const url = new URL(window.location.href);
  if (challengeId) url.searchParams.set("challenge", challengeId);
  else url.searchParams.delete("challenge");
  window.history.replaceState(null, "", url);
}
