import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type { AuthSessionResponse, ChallengeView } from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { InfoPanel } from "@/components/InfoPanel";
import { Button, Card, ErrorText, Field, Text, ui } from "@/components/ui";
import { useMobileApi } from "@/core/hooks";
import { useSession } from "@/core/session";
export default function Phone() {
  const api = useMobileApi();
  const { session, refresh } = useSession();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<ChallengeView>();
  const [phoneVersion, setPhoneVersion] = useState(
    session?.user.phoneVersion ?? 0,
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const submit = useMutation({
    mutationFn: async () => {
      let version = phoneVersion;
      if (phone && !challenge) {
        const updated = await api.call<AuthSessionResponse>(
          "/auth/phone",
          "PUT",
          {
            phoneNumber: phone.replace(/^0/u, "+84"),
            expectedPhoneVersion: version,
          },
        );
        version = updated.user.phoneVersion;
        setPhoneVersion(version);
        if (updated.user.nextAction === "NONE") {
          await refresh();
          router.replace("/(tabs)");
          return;
        }
      }
      setChallenge(
        await api.call<ChallengeView>(
          "/auth/otp",
          "POST",
          { purpose: "VERIFY_PHONE", phoneVersion: version },
          randomUUID(),
        ),
      );
    },
  });
  const verify = useMutation({
    mutationFn: async () => {
      await api.call<AuthSessionResponse>(
        `/auth/otp/${challenge!.challengeId}/verify`,
        "POST",
        { code },
        randomUUID(),
      );
      await refresh();
      router.replace("/(tabs)");
    },
  });
  if (!session?.authenticated) return <Redirect href="/sign-in" />;
  const resend = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAfter) - now) / 1000))
    : 0;
  const expired = challenge && Date.parse(challenge.expiresAt) <= now;
  return (
    <DetailPage
      title="Xác minh điện thoại"
      subtitle="Thêm một bước để kết nối an toàn"
    >
      <InfoPanel
        icon="shield-checkmark-outline"
        title={challenge ? "Kiểm tra mã xác nhận" : "Kết nối an toàn hơn"}
        description={
          challenge
            ? "Nhập mã bạn nhận được. Không chia sẻ mã xác nhận cho người khác."
            : "Xác minh số điện thoại để thuận tiện liên hệ khi cùng đi."
        }
      />
      <Card>
        <Text style={ui.sectionTitle}>
          {challenge ? "Nhập mã xác nhận" : "Số điện thoại của bạn"}
        </Text>
        <Text style={ui.muted}>
          {challenge
            ? `Mã đã gửi tới ${challenge.maskedPhone || session.user.phoneMasked}.`
            : "Số điện thoại giúp bạn liên hệ khi bắt đầu hành trình."}
        </Text>
        {!challenge ? (
          <>
            <Field
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="09xxxxxxxx"
            />
            <Button
              label="Gửi mã xác nhận"
              disabled={
                phone
                  ? !/^(0|\+84)[0-9]{9}$/u.test(phone)
                  : !session.user.phoneMasked
              }
              pending={submit.isPending}
              onPress={() => submit.mutate()}
            />
          </>
        ) : (
          <>
            <Field
              label="Mã OTP"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6 chữ số"
            />
            <Button
              label="Xác nhận"
              disabled={!/^\d{6}$/u.test(code) || !!expired}
              pending={verify.isPending}
              onPress={() => verify.mutate()}
            />
            {expired ? (
              <Text style={ui.muted}>Mã đã hết hạn. Hãy yêu cầu mã mới.</Text>
            ) : null}
            <Button
              label={resend ? `Gửi lại sau ${resend}s` : "Gửi lại mã"}
              variant="secondary"
              disabled={resend > 0}
              pending={submit.isPending}
              onPress={() => submit.mutate()}
            />
            <Button
              label="Đổi số điện thoại"
              variant="secondary"
              onPress={() => {
                setChallenge(undefined);
                setCode("");
              }}
            />
          </>
        )}
        <ErrorText error={submit.error || verify.error} />
      </Card>
    </DetailPage>
  );
}
