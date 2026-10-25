import { Linking, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import type { ConsentSummaryResponse } from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { InfoPanel } from "@/components/InfoPanel";
import { ResourceState } from "@/components/ResourceState";
import { Badge, Button, Card, ErrorText, Text, ui } from "@/components/ui";
import { useMobileApi, useResource, dateTime } from "@/core/hooks";
import { useSession } from "@/core/session";
const labels: Record<string, string> = {
  TERMS_OF_SERVICE: "Điều khoản sử dụng",
  PRIVACY_POLICY: "Chính sách riêng tư",
  LOCATION: "Chia sẻ vị trí",
  TERMS: "Điều khoản sử dụng",
  PRIVACY: "Chính sách riêng tư",
};
export default function Consent() {
  const api = useMobileApi();
  const { refresh, session } = useSession();
  const query = useResource<ConsentSummaryResponse>("consents", "/me/consents");
  const accept = useMutation({
    mutationFn: (type: string) =>
      api.call("/me/consents", "POST", {
        consentType: type,
        decision: "ACCEPTED",
        locale: "vi",
      }),
    onSuccess: async () => {
      await query.refetch();
      await refresh();
    },
  });
  const pending = query.data?.requirements.some((r) => !r.accepted);
  return (
    <DetailPage
      title="Điều khoản và đồng ý"
      subtitle="Minh bạch trong mỗi kết nối"
    >
      <InfoPanel
        icon="document-text-outline"
        title="Đọc trước khi đồng ý"
        description="Xem phiên bản tài liệu và lựa chọn của bạn cho mỗi nội dung bên dưới."
      />
      <ResourceState query={query}>
        {query.data?.requirements.map((r) => (
          <Card key={r.type}>
            <View style={ui.row}>
              <Text style={[ui.sectionTitle, { flex: 1 }]}>
                {labels[r.type] || r.type}
              </Text>
              <Badge label={r.accepted ? "Đã đồng ý" : "Cần xem lại"} />
            </View>
            <Text style={ui.muted}>Phiên bản {r.version}</Text>
            <Button
              label="Đọc tài liệu"
              icon="open-outline"
              variant="secondary"
              onPress={() => void Linking.openURL(r.documentUrl)}
            />
            {!r.accepted ? (
              <Button
                label="Tôi đã đọc và đồng ý"
                pending={accept.isPending}
                onPress={() => accept.mutate(r.type)}
              />
            ) : null}
          </Card>
        ))}
      </ResourceState>
      <ErrorText error={accept.error} />
      {!pending && query.data ? (
        <Button
          label="Tiếp tục"
          onPress={() =>
            router.replace(
              session?.user.nextAction === "SUBMIT_PHONE" ||
                session?.user.nextAction === "VERIFY_PHONE"
                ? "/onboarding/phone"
                : "/(tabs)",
            )
          }
        />
      ) : null}
      {query.data?.receipts.length ? (
        <Card>
          <Text style={ui.sectionTitle}>Lịch sử chấp thuận</Text>
          {query.data.receipts.map((r) => (
            <Text key={r.id} style={ui.muted}>
              {labels[r.type] || r.type} · {dateTime(r.occurredAt)}
            </Text>
          ))}
        </Card>
      ) : null}
    </DetailPage>
  );
}
