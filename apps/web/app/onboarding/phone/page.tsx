"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Input } from "@dike/web-ui";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const submit = useMutation({
    mutationFn: ({ phoneNumber }: FormValues) =>
      authApi.submitPhone(phoneNumber),
    onSuccess: async (session) => {
      queryClient.setQueryData(["auth", "session"], session);
      await router.replace("/");
    },
  });
  useAuthFailure(submit.error);

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <p className="eyebrow">Bước cuối của Stage 2</p>
        <h1>Thêm số điện thoại</h1>
        <p className="auth-copy">
          Số này vẫn ở trạng thái chưa xác minh cho đến khi luồng OTP được bật.
        </p>
        <form onSubmit={form.handleSubmit((values) => submit.mutate(values))}>
          <Input
            label="Số điện thoại Việt Nam"
            autoComplete="tel"
            inputMode="tel"
            placeholder="0901 234 567"
            error={form.formState.errors.phoneNumber?.message}
            {...form.register("phoneNumber")}
          />
          {submit.isError ? (
            <p className="auth-error" role="alert">
              Không thể lưu số điện thoại. Hãy kiểm tra và thử lại.
            </p>
          ) : null}
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? "Đang lưu…" : "Tiếp tục"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
