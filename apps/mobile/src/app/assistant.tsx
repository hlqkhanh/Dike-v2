import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
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
import { Button, Field, Icon, Text, TextInput } from "@/components/ui";
import { PlacePicker } from "@/components/PlacePicker";
import { useMobileApi, dateTime, statusLabel } from "@/core/hooks";
import { theme } from "@/core/theme";

export default function Assistant() {
  const api = useMobileApi();
  const palette = theme.assistant.light;
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
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const voicePrefix = useRef("");

  useSpeechRecognitionEvent("start", () => {
    setListening(true);
    setVoiceError("");
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    setText([voicePrefix.current, transcript].filter(Boolean).join(" "));
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    setVoiceError(
      event.error === "no-speech"
        ? "Chưa nghe thấy giọng nói. Hãy thử lại."
        : event.error === "not-allowed"
          ? "Cần quyền micro để nhập nội dung bằng giọng nói."
          : "Chưa nhận dạng được giọng nói. Hãy thử lại.",
    );
  });

  async function toggleListening() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    setVoiceError("");
    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setVoiceError("Cần quyền micro để nhập nội dung bằng giọng nói.");
      return;
    }
    voicePrefix.current = text.trim();
    ExpoSpeechRecognitionModule.start({
      lang: "vi-VN",
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  }

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
      const saved = await api.call<DikeAssistantResult>(
          `/assistant/conversations/${conversation}/confirm`,
          "POST",
          {
            version: draft.version,
            fields,
            originPlaceRef: origin.placeRef,
            destinationPlaceRef: destination.placeRef,
          },
        );
      setResult(saved);
      if (saved.kind === "INTENT") {
        router.replace({
          pathname: "/create-trip",
          params: {
            review: "assistant",
            mode: fields.role === "DRIVER" ? "driver" : "passenger",
            origin: JSON.stringify(origin),
            destination: JSON.stringify(destination),
            departure: `${fields.date} ${fields.departureTime}`,
            seats: fields.seats || "1",
          },
        });
      }
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
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
            style={styles.headerButton}
          >
            <Icon name="arrow-back" size={23} color="#123d34" />
          </Pressable>
          <View style={styles.assistantIdentity}>
            <LinearGradient
              colors={["#10a47d", "#087d61"]}
              style={styles.assistantAvatar}
            >
              <Icon name="sparkles" size={21} color="#ffffff" />
            </LinearGradient>
            <View style={styles.assistantNameBlock}>
              <Text style={styles.headerTitle}>Trợ lý AI</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Sẵn sàng hỗ trợ</Text>
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa hội thoại"
            disabled={pending}
            onPress={() => void reset()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
              pending && styles.disabled,
            ]}
          >
            <Icon name="trash-outline" size={21} color="#527066" />
          </Pressable>
        </View>
        <FlatList
          data={messages}
          keyExtractor={(_, i) => String(i)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            messages.length === 0 && !draft ? (
              <View style={styles.welcomeCard}>
                <LinearGradient
                  colors={["#e8f8f2", "#f7fcfa", "#ffffff"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.welcomeIcon}>
                  <Icon name="sparkles" size={24} color="#087d61" />
                </View>
                <Text accessibilityRole="header" style={styles.heading}>
                  Bạn muốn đi đâu hôm nay?
                </Text>
                <Text style={styles.welcomeText}>
                  Mình có thể giúp tạo chuyến, lên lịch định kỳ hoặc giải đáp về
                  hành trình của bạn.
                </Text>
                <View style={styles.suggestions}>
                  {assistantSuggestions.map((value, index) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      disabled={pending}
                      onPress={() => {
                        setText(value);
                        void send(value);
                      }}
                      style={({ pressed }) => [
                        styles.suggestion,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon
                        name={
                          ([
                            "navigate-outline",
                            "calendar-outline",
                            "help-circle-outline",
                          ][index % 3] ?? "sparkles-outline") as
                            | "navigate-outline"
                            | "calendar-outline"
                            | "help-circle-outline"
                        }
                        size={18}
                        color="#087d61"
                      />
                      <Text style={styles.suggestionText}>{value}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.privacyNote}>
                  <Icon
                    name="shield-checkmark-outline"
                    size={15}
                    color="#6d8a81"
                  />
                  <Text style={styles.privacyText}>
                    Không chia sẻ OTP, giấy tờ hoặc thông tin thanh toán.
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyPrompt}>
              <Text style={styles.emptyPromptText}>
                Chọn một gợi ý hoặc nhập câu hỏi để bắt đầu trò chuyện.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageRow,
                item.role === "Bạn" && styles.userMessageRow,
              ]}
            >
              {item.role !== "Bạn" ? (
                <View style={styles.messageAvatar}>
                  <Icon name="sparkles" size={14} color="#ffffff" />
                </View>
              ) : null}
              <View
                style={[
                  styles.messageBubble,
                  item.role === "Bạn"
                    ? styles.userBubble
                    : styles.assistantBubble,
                ]}
              >
                <Text
                  selectable
                  style={[
                    styles.messageText,
                    item.role === "Bạn" && styles.userMessageText,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
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
                <View style={styles.draftCard}>
                  <View style={styles.draftHeader}>
                    <View style={styles.draftIcon}>
                      <Icon
                        name="document-text-outline"
                        size={19}
                        color="#087d61"
                      />
                    </View>
                    <View style={styles.draftTitleBlock}>
                      <Text
                        accessibilityRole="header"
                        style={styles.draftTitle}
                      >
                        {draft.kind === "SCHEDULE"
                          ? "Bản nháp lịch định kỳ"
                          : "Bản nháp nhu cầu một lần"}
                      </Text>
                      <Text style={styles.draftBadge}>AI đã chuẩn bị</Text>
                    </View>
                  </View>
                  <Text style={styles.mutedText}>
                    Múi giờ Việt Nam · Chỉ mình tôi. Lưu chưa đăng bài hoặc có
                    booking.
                  </Text>
                  {fields.seats && (
                    <Text style={styles.mutedText}>
                      Số chỗ mong muốn: {fields.seats}; chọn số chỗ khi đăng bài
                      sau khi lưu.
                    </Text>
                  )}
                  <Text style={styles.routeHint}>
                    Gợi ý: {fields.originQuery} → {fields.destinationQuery}.
                    Chọn địa chỉ cụ thể bên dưới.
                  </Text>
                  <PlacePicker
                    key={`origin-${draft.version}`}
                    label="Nơi xuất phát"
                    containerStyle={styles.place}
                    initialQuery={fields.originQuery}
                    value={origin}
                    onChange={setOrigin}
                    disabled={pending}
                  />
                  <PlacePicker
                    key={`destination-${draft.version}`}
                    label="Nơi đến / học / làm"
                    containerStyle={styles.place}
                    initialQuery={fields.destinationQuery}
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
                        {fields.date} · {fields.departureTime}
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
        <View style={styles.composer}>
          <View style={styles.composerField}>
            <TextInput
              accessibilityLabel="Tin nhắn cho trợ lý AI"
              value={text}
              editable={!pending}
              maxLength={2000}
              onChangeText={setText}
              placeholder="Nhắn cho trợ lý AI…"
              placeholderTextColor="#82978f"
              multiline
              style={styles.composerInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                listening ? "Dừng nhập bằng giọng nói" : "Nhập bằng giọng nói"
              }
              disabled={pending}
              onPress={() => void toggleListening()}
              style={({ pressed }) => [
                styles.voiceButton,
                listening && styles.voiceButtonActive,
                pending && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name={listening ? "stop" : "mic"}
                size={20}
                color={listening ? "#ffffff" : "#087d61"}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
              disabled={pending || !text.trim()}
              onPress={() => void send(text)}
              style={({ pressed }) => [
                styles.sendButton,
                (!text.trim() || pending) && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="arrow-up" size={21} color="#ffffff" />
            </Pressable>
          </View>
          {listening ? (
            <Text accessibilityLiveRegion="polite" style={styles.listeningText}>
              Đang nghe… nói nội dung chuyến đi của bạn
            </Text>
          ) : voiceError ? (
            <Text accessibilityLiveRegion="assertive" style={styles.voiceError}>
              {voiceError}
            </Text>
          ) : null}
          <Text style={styles.composerCaption}>
            AI có thể mắc lỗi. Hãy kiểm tra thông tin trước khi xác nhận.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  place: {
    backgroundColor: "#f7fbf9",
    borderRadius: 16,
    padding: 10,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5efeb",
    backgroundColor: "#ffffff",
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f8f5",
  },
  assistantIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  assistantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  assistantNameBlock: { flex: 1, minWidth: 0 },
  headerTitle: {
    color: "#123d34",
    fontFamily: theme.font.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#14a47d",
  },
  statusText: { color: "#6d8a81", fontSize: 11, lineHeight: 16 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 14,
  },
  group: { gap: 10 },
  welcomeCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dcece6",
  },
  welcomeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dff4eb",
    marginBottom: 12,
  },
  heading: {
    color: "#123d34",
    fontSize: 23,
    lineHeight: 30,
    textAlign: "center",
    fontFamily: theme.font.bold,
  },
  welcomeText: {
    marginTop: 7,
    color: "#527066",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  suggestions: { width: "100%", gap: 9, marginTop: 18 },
  suggestion: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "#d7e9e2",
  },
  suggestionText: {
    flex: 1,
    color: "#244f45",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: theme.font.semibold,
  },
  privacyNote: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  privacyText: { color: "#6d8a81", fontSize: 10, lineHeight: 15 },
  emptyPrompt: { paddingHorizontal: 20, alignItems: "center" },
  emptyPromptText: {
    color: "#82978f",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
  messageRow: {
    maxWidth: "88%",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
  },
  userMessageRow: { alignSelf: "flex-end" },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#087d61",
    alignItems: "center",
    justifyContent: "center",
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
  },
  assistantBubble: {
    backgroundColor: "#f0f7f4",
    borderBottomStartRadius: 5,
    borderWidth: 1,
    borderColor: "#e0ece7",
  },
  userBubble: {
    backgroundColor: "#087d61",
    borderBottomEndRadius: 5,
  },
  messageText: { color: "#173d35", fontSize: 14, lineHeight: 21 },
  userMessageText: { color: "#ffffff" },
  draftCard: {
    padding: 16,
    borderRadius: 22,
    gap: 13,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cfe5dd",
    shadowColor: "#063b2f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  draftHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  draftIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#e6f6f0",
    alignItems: "center",
    justifyContent: "center",
  },
  draftTitleBlock: { flex: 1, minWidth: 0 },
  draftTitle: {
    color: "#123d34",
    fontFamily: theme.font.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  draftBadge: { color: "#087d61", fontSize: 11, lineHeight: 16 },
  mutedText: { color: "#6d8a81", fontSize: 12, lineHeight: 18 },
  routeHint: {
    color: "#244f45",
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f1f8f5",
  },
  composer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 5,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5efeb",
  },
  composerField: {
    minHeight: 54,
    maxHeight: 126,
    paddingStart: 16,
    paddingEnd: 5,
    paddingVertical: 5,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "#f1f7f4",
    borderWidth: 1,
    borderColor: "#dbe9e4",
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    paddingVertical: 10,
    color: "#123d34",
    fontFamily: theme.font.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#087d61",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e3f3ed",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceButtonActive: { backgroundColor: "#e05252" },
  listeningText: {
    color: "#087d61",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: theme.font.semibold,
  },
  voiceError: {
    color: "#b33b3b",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
  },
  sendButtonDisabled: { backgroundColor: "#aec8bf" },
  composerCaption: {
    color: "#8aa097",
    textAlign: "center",
    fontSize: 9,
    lineHeight: 13,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});
