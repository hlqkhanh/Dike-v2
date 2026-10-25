import { Switch, View } from "react-native";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { PrivacyResponse } from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { InfoPanel } from "@/components/InfoPanel";
import { ResourceState } from "@/components/ResourceState";
import { Button, Card, Chip, ErrorText, Text, ui } from "@/components/ui";
import { useMobileApi, useResource } from "@/core/hooks";
export default function Privacy() {
  const query = useResource<PrivacyResponse>("privacy", "/me/privacy");
  const [saved, setSaved] = useState(false);
  return (
    <DetailPage
      title="Quyền riêng tư"
      subtitle="Chủ động với thông tin của bạn"
    >
      <InfoPanel
        icon="lock-closed-outline"
        title="Bạn quyết định ai được kết nối"
        description="Chọn cách hồ sơ xuất hiện và ai có thể gửi lời mời nhắn tin."
      />
      {saved ? (
        <Text accessibilityRole="alert" style={ui.muted}>
          Đã lưu quyền riêng tư.
        </Text>
      ) : null}
      <ResourceState query={query}>
        {query.data ? (
          <Editor
            key={query.data.version}
            data={query.data}
            onSaved={() => {
              setSaved(true);
              void query.refetch();
            }}
          />
        ) : null}
      </ResourceState>
    </DetailPage>
  );
}
function Editor({
  data,
  onSaved,
}: {
  data: PrivacyResponse;
  onSaved: () => void;
}) {
  const api = useMobileApi();
  const [visibility, setVisibility] = useState(data.profileVisibility);
  const [discoverable, setDiscoverable] = useState(data.discoverableByName);
  const [messages, setMessages] = useState(data.allowMessageRequests);
  const save = useMutation({
    mutationFn: () =>
      api.call<PrivacyResponse>("/me/privacy", "PATCH", {
        profileVisibility: visibility,
        discoverableByName: discoverable,
        allowMessageRequests: messages,
        expectedVersion: data.version,
      }),
    onSuccess: onSaved,
  });
  return (
    <Card>
      <Text style={ui.sectionTitle}>Ai xem được hồ sơ?</Text>
      <View style={ui.wrap}>
        {[
          ["MEMBERS", "Thành viên"],
          ["PRIVATE", "Chỉ mình tôi"],
        ].map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={visibility === value}
            onPress={() => setVisibility(value)}
          />
        ))}
      </View>
      {[
        { title: "Tìm bằng tên", value: discoverable, set: setDiscoverable },
        { title: "Nhận lời mời nhắn tin", value: messages, set: setMessages },
      ].map((item) => (
        <View key={item.title} style={[ui.row, { minHeight: 64 }]}>
          <Text style={{ flex: 1, fontSize: 15 }}>{item.title}</Text>
          <Switch
            accessibilityLabel={item.title}
            value={item.value}
            onValueChange={item.set}
            trackColor={{ true: "#087d61" }}
          />
        </View>
      ))}
      <ErrorText error={save.error} />
      <Button
        label="Lưu quyền riêng tư"
        pending={save.isPending}
        onPress={() => save.mutate()}
      />
    </Card>
  );
}
