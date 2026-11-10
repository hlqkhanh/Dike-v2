import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  assistantSuggestions,
  assistantFields,
  assistantFieldKeys,
  assistantOptionLabels,
  type DikeAssistantConversation,
  type DikeAssistantDraft,
  type DikeAssistantReply,
  type DikeAssistantResult,
  type PlaceResponse,
} from "@dike/api-client-ts";
import { Button, Field, Text } from "@/components/ui";
import { PlacePicker } from "@/components/PlacePicker";
import { useMobileApi, dateTime, statusLabel } from "@/core/hooks";
import { theme } from "@/core/theme";

export default function Assistant() {
  const api = useMobileApi();
  const palette =
    useColorScheme() === "dark" ? theme.assistant.dark : theme.assistant.light;
  const [conversation, setConversation] = useState<string>();
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
    [],
  );
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<DikeAssistantDraft | null>(null);
  const [reply, setReply] = useState<DikeAssistantReply>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState<PlaceResponse>();
  const [destination, setDestination] = useState<PlaceResponse>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DikeAssistantResult>();

  async function send(value: string) {
    if (pending || !value.trim()) return;
    setPending(true);
    setError("");
    try {
      let id = conversation;
      if (!id) {
        const created = await api.call<DikeAssistantConversation>(
          "/assistant/conversations",
          "POST",
        );
        id = created.id;
        setConversation(id);
      }
      const answer = await api.call<DikeAssistantReply>(
        `/assistant/conversations/${id}/messages`,
        "POST",
        {
          text: value,
          ...(draft && !result ? { draftVersion: draft.version, fields } : {}),
        },
      );
      setMessages((previous) => [
        ...previous.slice(-19),
        { role: "Bạn", text: value },
        { role: "Dike", text: answer.text },
      ]);
      setReply(answer);
      setText("");
      if (JSON.stringify(answer.draft) !== JSON.stringify(draft)) {
        setDraft(answer.draft);
        setFields(answer.draft?.fields ?? {});
        setResult(undefined);
        if (
          answer.draft?.id !== draft?.id ||
          answer.draft?.fields.originQuery !== draft?.fields.originQuery
        )
          setOrigin(undefined);
        if (
          answer.draft?.id !== draft?.id ||
          answer.draft?.fields.destinationQuery !==
            draft?.fields.destinationQuery
        )
          setDestination(undefined);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chưa kết nối được. Kiểm tra mạng và thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!draft || !origin || !destination || pending) return;
    setPending(true);
    setError("");
    try {
      setResult(
        await api.call<DikeAssistantResult>(
          `/assistant/conversations/${conversation}/confirm`,
          "POST",
          {
            version: draft.version,
            fields,
            originPlaceRef: origin.placeRef,
            destinationPlaceRef: destination.placeRef,
          },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa lưu được. Hãy thử lại.");
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    setPending(true);
    setError("");
    try {
      if (conversation)
        await api.call(`/assistant/conversations/${conversation}`, "DELETE");
      setConversation(undefined);
      setMessages([]);
      setDraft(null);
      setReply(undefined);
      setResult(undefined);
      setFields({});
      setOrigin(undefined);
      setDestination(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa xóa được hội thoại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.canvas }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.toolbar}>
          <Button
            label="Quay lại"
            variant="secondary"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
          />
          <Button
            label="Xóa hội thoại"
            variant="secondary"
            disabled={pending}
            onPress={() => void reset()}
          />
        </View>
        <FlatList
          data={messages}
          keyExtractor={(_, i) => String(i)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.group}>
              <Text
                accessibilityRole="header"
                style={[styles.heading, { color: palette.ink }]}
              >
                Trợ lý Dike
              </Text>
              <Text style={{ color: palette.ink }}>
                Tạo nhu cầu, lịch định kỳ và hỏi về chuyến đi.
              </Text>
              <Text style={{ color: palette.muted }}>
                Nội dung nhập tự nhiên và bản nháp được gửi đến dịch vụ AI.
                Không gửi OTP, giấy tờ hoặc thông tin thanh toán. Hội thoại hết
                hạn sau 24 giờ. Bạn xác nhận trước khi lưu.
              </Text>
              {assistantSuggestions.map((value) => (
                <Button
                  key={value}
                  label={value}
                  variant="secondary"
                  disabled={pending}
                  onPress={() => {
                    setText(value);
                    void send(value);
                  }}
                />
              ))}
            </View>
          }
          ListEmptyComponent={
            <Text style={{ color: palette.muted }}>
              Chọn một gợi ý hoặc mô tả lịch của bạn để bắt đầu.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: palette.surface }]}>
              <Text style={{ color: palette.ink }}>{item.role}</Text>
              <Text selectable style={{ color: palette.ink }}>
                {item.text}
              </Text>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.group}>
              {reply?.checkedAt && (
                <View style={styles.group}>
                  <Text style={{ color: palette.ink }}>
                    Booking · Cập nhật {dateTime(reply.checkedAt)}
                  </Text>
                  {reply.bookings.length === 0 && (
                    <Text style={{ color: palette.muted }}>
                      Bạn chưa có booking.
                    </Text>
                  )}
                  {reply.bookings.map((booking) => (
                    <Button
                      key={booking.id}
                      label={`${statusLabel(booking.status)} · ${dateTime(booking.pickupAt ?? undefined)}`}
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/booking/[id]",
                          params: { id: booking.id },
                        })
                      }
                    />
                  ))}
                </View>
              )}
              {draft && !result && (
                <View
                  style={[styles.card, { backgroundColor: palette.surface }]}
                >
                  <Text
                    accessibilityRole="header"
                    style={{ color: palette.ink }}
                  >
                    {draft.kind === "SCHEDULE"
                      ? "Bản nháp lịch định kỳ"
                      : "Bản nháp nhu cầu một lần"}
                  </Text>
                  <Text style={{ color: palette.muted }}>
                    Múi giờ Việt Nam · Chỉ mình tôi. Lưu chưa đăng bài hoặc có
                    booking.
                  </Text>
                  {fields.seats && (
                    <Text style={{ color: palette.muted }}>
                      Số chỗ mong muốn: {fields.seats}; chọn số chỗ khi đăng bài
                      sau khi lưu.
                    </Text>
                  )}
                  <Text style={{ color: palette.muted }}>
                    Gợi ý: {fields.originQuery} → {fields.destinationQuery}.
                    Chọn địa chỉ cụ thể bên dưới.
                  </Text>
                  <PlacePicker
                    key={`origin-${draft.version}`}
                    label="Nơi xuất phát"
                    containerStyle={styles.place}
                    value={origin}
                    onChange={setOrigin}
                    disabled={pending}
                  />
                  <PlacePicker
                    key={`destination-${draft.version}`}
                    label="Nơi đến / học / làm"
                    containerStyle={styles.place}
                    value={destination}
                    onChange={setDestination}
                    disabled={pending}
                  />
                  {assistantFieldKeys(draft.kind).map((key) => {
                    const field = assistantFields[key];
                    return field.options ? (
                      <View key={key} style={styles.group}>
                        <Text style={{ color: palette.ink }}>
                          {field.label}
                        </Text>
                        {field.options.map((option) => (
                          <Button
                            key={option}
                            label={`${(key === "weekdays" ? (fields[key] ?? "").split(",").includes(option) : fields[key] === option) ? "Đã chọn: " : ""}${assistantOptionLabels[option] ?? option}`}
                            variant="secondary"
                            disabled={pending}
                            onPress={() =>
                              setFields({
                                ...fields,
                                [key]:
                                  key === "weekdays"
                                    ? ((fields[key] ?? "")
                                        .split(",")
                                        .includes(option)
                                        ? (fields[key] ?? "")
                                            .split(",")
                                            .filter((day) => day !== option)
                                        : [
                                            ...(fields[key] ?? "")
                                              .split(",")
                                              .filter(Boolean),
                                            option,
                                          ]
                                      ).join(",")
                                    : option,
                              })
                            }
                          />
                        ))}
                      </View>
                    ) : (
                      <Field
                        key={key}
                        label={field.label}
                        labelStyle={{ color: palette.ink }}
                        value={fields[key] ?? ""}
                        editable={!pending}
                        onChangeText={(value) =>
                          setFields({ ...fields, [key]: value })
                        }
                        placeholder={
                          field.type === "date"
                            ? "YYYY-MM-DD"
                            : field.type === "time"
                              ? "HH:mm"
                              : ""
                        }
                        style={{
                          color: palette.ink,
                          backgroundColor: palette.canvas,
                        }}
                      />
                    );
                  })}
                  <Button
                    label="Xác nhận lưu"
                    pending={pending}
                    disabled={!origin || !destination}
                    onPress={() => void confirm()}
                  />
                  <Button
                    label="Bỏ bản nháp"
                    variant="secondary"
                    disabled={pending}
                    onPress={() => void send("Bỏ bản nháp")}
                  />
                </View>
              )}
              {result && (
                <View style={styles.group} accessibilityLiveRegion="polite">
                  <Text style={{ color: palette.ink }}>
                    Đã lưu thành công. Lưu lịch/nhu cầu chưa tạo booking.
                  </Text>
                  {result.warnings.map((warning) => (
                    <Text key={warning} style={{ color: palette.ink }}>
                      {warning}
                    </Text>
                  ))}
                  {result.kind === "SCHEDULE" ? (
                    <Button
                      label="Mở lịch trình"
                      onPress={() => router.push("/schedules")}
                    />
                  ) : (
                    <>
                      <Text selectable style={{ color: palette.ink }}>
                        Mã nhu cầu: {result.id}
                      </Text>
                      <Text style={{ color: palette.ink }}>
                        {origin?.displayLabel} → {destination?.displayLabel}
                      </Text>
                      <Text style={{ color: palette.ink }}>
                        {fields.date} · {fields.departureTime}–
                        {fields.arrivalTime}
                      </Text>
                    </>
                  )}
                </View>
              )}
              {pending && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: palette.muted }}
                >
                  Đang xử lý…
                </Text>
              )}
              {error && (
                <View accessibilityLiveRegion="assertive" style={styles.group}>
                  <Text style={{ color: palette.error }}>{error}</Text>
                  <Button
                    label="Dùng form tạo lịch"
                    variant="secondary"
                    onPress={() => router.push("/schedules/edit")}
                  />
                </View>
              )}
            </View>
          }
        />
        <View style={[styles.composer, { backgroundColor: palette.canvas }]}>
          <Field
            label="Tin nhắn của bạn"
            labelStyle={{ color: palette.ink }}
            value={text}
            editable={!pending}
            maxLength={2000}
            onChangeText={setText}
            placeholder="Mô tả lịch hoặc đặt câu hỏi…"
            style={{ color: palette.ink, backgroundColor: palette.surface }}
          />
          <Button
            label="Gửi tin nhắn"
            pending={pending}
            disabled={!text.trim()}
            onPress={() => void send(text)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  place: {
    backgroundColor: theme.assistant.light.canvas,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  content: { padding: theme.spacing.md, gap: theme.spacing.md },
  group: { gap: theme.spacing.sm },
  heading: { fontSize: theme.assistant.titleSize, fontFamily: theme.font.bold },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    gap: theme.spacing.md,
  },
  composer: { padding: theme.spacing.md, gap: theme.spacing.sm },
});
