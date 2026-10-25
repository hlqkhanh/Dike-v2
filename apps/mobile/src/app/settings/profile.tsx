import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { MyProfileResponse } from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { InfoPanel } from "@/components/InfoPanel";
import { ResourceState } from "@/components/ResourceState";
import {
  Avatar,
  Button,
  Card,
  ErrorText,
  Field,
  Text,
  ui,
} from "@/components/ui";
import { useResource, useMobileApi } from "@/core/hooks";
import { useSession } from "@/core/session";
export default function ProfileSettings() {
  const query = useResource<MyProfileResponse>("my-profile", "/me/profile");
  const [saved, setSaved] = useState(false);
  return (
    <DetailPage
      title="Chỉnh sửa hồ sơ"
      subtitle="Để người cùng đường hiểu bạn hơn"
    >
      <InfoPanel
        icon="person-outline"
        title="Thêm một chút về bạn"
        description="Tên và lời giới thiệu giúp người cùng đường nhận ra bạn khi kết nối."
      />
      {saved ? (
        <Text accessibilityRole="alert" style={ui.muted}>
          Đã lưu hồ sơ của bạn.
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
  data: MyProfileResponse;
  onSaved: () => void;
}) {
  const api = useMobileApi();
  const { refresh } = useSession();
  const [name, setName] = useState(data.displayName);
  const [bio, setBio] = useState(data.bio || "");
  const [facebook, setFacebook] = useState(data.facebookUrl || "");
  const save = useMutation({
    mutationFn: () =>
      api.call<MyProfileResponse>("/me/profile", "PATCH", {
        displayName: name.trim(),
        bio: bio.trim(),
        facebookUrl: facebook.trim() || null,
        expectedVersion: data.version,
      }),
    onSuccess: async () => {
      await refresh();
      onSaved();
    },
  });
  return (
    <Card>
      <Avatar name={data.displayName} uri={data.avatarUrl} size={76} />
      <Field
        label="Tên hiển thị"
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <Field
        label="Giới thiệu"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={500}
      />
      <Field
        label="Facebook"
        value={facebook}
        onChangeText={setFacebook}
        autoCapitalize="none"
        placeholder="https://www.facebook.com/..."
      />
      <ErrorText error={save.error} />
      {save.isSuccess ? <Text style={ui.muted}>Đã lưu hồ sơ.</Text> : null}
      <Button
        label="Lưu thay đổi"
        icon="checkmark-outline"
        pending={save.isPending}
        disabled={name.trim().length < 2}
        onPress={() => save.mutate()}
      />
    </Card>
  );
}
