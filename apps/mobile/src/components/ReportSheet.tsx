import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useMobileApi } from "@/core/hooks";
import { BottomSheet, Button, Chip, ErrorText, Field, Text, ui } from "./ui";
import { InfoPanel } from "./InfoPanel";
export function ReportSheet({
  visible,
  onClose,
  targetId,
  targetType,
}: {
  visible: boolean;
  onClose: () => void;
  targetId: string;
  targetType: "USER" | "POST";
}) {
  const api = useMobileApi();
  const [reason, setReason] = useState("UNSAFE");
  const [note, setNote] = useState("");
  const report = useMutation({
    mutationFn: () =>
      api.call(
        "/reports",
        "POST",
        { targetType, targetId, reason, note },
        randomUUID(),
      ),
  });
  return (
    <BottomSheet visible={visible} title="Báo cáo an toàn" onClose={onClose}>
      {report.isSuccess ? (
        <>
          <InfoPanel
            icon="checkmark-circle-outline"
            title="Báo cáo đã được gửi"
            description="Cảm ơn bạn đã giúp giữ cộng đồng cùng đi an toàn."
          />
          <Text style={ui.muted}>
            Dike đã nhận báo cáo. Đội ngũ kiểm duyệt sẽ xem xét nội dung.
          </Text>
          <Button label="Đóng" onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={ui.muted}>Chọn lý do để Dike hỗ trợ đúng vấn đề.</Text>
          <View style={ui.wrap}>
            {[
              ["UNSAFE", "Không an toàn"],
              ["SPAM", "Spam"],
              ["MISLEADING", "Sai thông tin"],
              ["OTHER", "Khác"],
            ].map(([v, l]) => (
              <Chip
                key={v}
                label={l}
                selected={reason === v}
                onPress={() => setReason(v)}
              />
            ))}
          </View>
          <Field
            label="Thông tin bổ sung"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
          />
          <ErrorText error={report.error} />
          <Button
            label="Gửi báo cáo"
            pending={report.isPending}
            onPress={() => report.mutate()}
          />
        </>
      )}
    </BottomSheet>
  );
}
