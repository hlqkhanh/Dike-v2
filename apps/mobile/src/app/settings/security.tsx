import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { SessionListResponse } from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { InfoPanel } from "@/components/InfoPanel";
import { ResourceState } from "@/components/ResourceState";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  ErrorText,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, useResource, dateTime } from "@/core/hooks";
import { useSession } from "@/core/session";
export default function Security() {
  const api = useMobileApi();
  const { signOut } = useSession();
  const query = useResource<SessionListResponse>("sessions", "/auth/sessions");
  const [target, setTarget] = useState<string>();
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api.call(`/auth/sessions/${encodeURIComponent(id)}`, "DELETE"),
    onSuccess: () => {
      setTarget(undefined);
      void query.refetch();
    },
  });
  const out = useMutation({ mutationFn: signOut });
  return (
    <DetailPage
      title="Bảo mật và thiết bị"
      subtitle="Chỉ giữ những phiên bạn nhận ra"
    >
      <InfoPanel
        icon="key-outline"
        title="Giữ kết nối trong tầm kiểm soát"
        description="Kiểm tra thiết bị và thu hồi những phiên bạn không còn sử dụng."
      />
      <ResourceState query={query}>
        {query.data?.sessions.map((s) => (
          <Card key={s.id}>
            <Text style={ui.sectionTitle}>
              {s.deviceLabel || "Thiết bị Dike"}
            </Text>
            {s.current ? <Badge label="Thiết bị hiện tại" /> : null}
            <Text style={ui.muted}>Hoạt động: {dateTime(s.lastSeenAt)}</Text>
            <Text style={ui.muted}>
              Hết hạn: {dateTime(s.absoluteExpiresAt)}
            </Text>
            {!s.current ? (
              <Button
                label="Thu hồi phiên"
                variant="secondary"
                onPress={() => setTarget(s.id)}
              />
            ) : null}
          </Card>
        ))}
      </ResourceState>
      <ErrorText error={out.error} />
      <Button
        label="Đăng xuất thiết bị này"
        variant="danger"
        pending={out.isPending}
        onPress={() => out.mutate()}
      />
      <BottomSheet
        visible={!!target}
        title="Thu hồi phiên đăng nhập?"
        onClose={() => setTarget(undefined)}
      >
        <Text style={ui.muted}>
          Thiết bị này sẽ cần đăng nhập lại để tiếp tục dùng Dike.
        </Text>
        <ErrorText error={revoke.error} />
        <Button
          label="Thu hồi"
          variant="danger"
          pending={revoke.isPending}
          onPress={() => target && revoke.mutate(target)}
        />
      </BottomSheet>
    </DetailPage>
  );
}
