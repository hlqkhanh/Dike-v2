import type {
  PlaceResponse,
  PlaceSuggestionResponse,
} from "@dike/api-client-ts";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useMobileApi } from "@/core/hooks";
import { theme } from "@/core/theme";
import { ErrorText, Icon, Text, ui } from "./ui";

export function PlacePicker({
  label,
  value,
  onChange,
  disabled,
  autoFocus,
  compact,
  onFocus,
}: {
  label: string;
  value?: PlaceResponse;
  onChange: (p?: PlaceResponse) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  onFocus?: () => void;
}) {
  const api = useMobileApi();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestionResponse[]>([]);
  const session = useRef<
    { sessionToken: string; expiresAt: string } | undefined
  >(undefined);
  const revision = useRef(0);
  const search = useMutation({
    mutationFn: async () => {
      const r = ++revision.current;
      if (
        !session.current ||
        Date.parse(session.current.expiresAt) <= Date.now()
      )
        session.current = await api.call("/routing/place-sessions", "POST");
      const items = await api.call<PlaceSuggestionResponse[]>(
        `/routing/places?${new URLSearchParams({ sessionToken: session.current!.sessionToken, query: text.trim() })}`,
      );
      if (r === revision.current) setSuggestions(items);
    },
  });
  const choose = useMutation({
    mutationFn: async (ref: string) => {
      const r = ++revision.current;
      const p = await api.call<PlaceResponse>(
        "/routing/places/resolve",
        "POST",
        { sessionToken: session.current!.sessionToken, placeRef: ref },
      );
      if (r === revision.current) {
        onChange(p);
        setText(p.displayLabel);
        setSuggestions([]);
      }
    },
  });
  const runSearch = search.mutate;
  useEffect(() => {
    if (disabled || value || text.trim().length < 3) return;
    const timer = setTimeout(() => runSearch(), 500);
    return () => clearTimeout(timer);
  }, [disabled, value, text, runSearch]);
  const cannotSearch =
    !!disabled ||
    text.trim().length < 3 ||
    choose.isPending ||
    search.isPending;
  const buttonDisabled = value ? !!disabled : cannotSearch;
  return (
    <View style={styles.group}>
      {!compact ? <Text style={ui.label}>{label}</Text> : null}
      <View
        style={[
          styles.searchBox,
          value && styles.searchBoxSelected,
          compact && styles.compactBox,
        ]}
      >
        <Icon
          name={
            value ? "checkmark-circle" : compact ? "stop" : "location-outline"
          }
          size={20}
          color={
            compact
              ? label === "Điểm đi"
                ? theme.destination.ink
                : theme.destination.marker
              : theme.colors.primary
          }
        />
        <TextInput
          accessibilityLabel={label}
          autoFocus={autoFocus}
          onFocus={onFocus}
          editable={!disabled}
          value={value?.displayLabel ?? text}
          onChangeText={(q) => {
            revision.current++;
            setText(q);
            onChange(undefined);
            setSuggestions([]);
          }}
          onSubmitEditing={() => {
            if (!cannotSearch) search.mutate();
          }}
          returnKeyType="search"
          placeholder={
            compact
              ? label === "Điểm đi"
                ? "Bạn khởi hành từ đâu?"
                : "Bạn muốn đi đâu?"
              : "Nhập địa điểm"
          }
          placeholderTextColor={theme.colors.inkMuted}
          style={[styles.input, compact && styles.compactInput]}
        />
        {!compact || value || text.trim().length >= 3 ? (
          <Pressable
            accessibilityLabel={value ? "Thay đổi địa điểm" : "Tìm địa điểm"}
            accessibilityRole="button"
            accessibilityState={{
              busy: search.isPending,
              disabled: buttonDisabled,
            }}
            disabled={buttonDisabled}
            onPress={() => {
              if (value) {
                setText(value.displayLabel);
                onChange(undefined);
              } else search.mutate();
            }}
            style={({ pressed }) => [
              styles.searchButton,
              compact && styles.compactSearch,
              buttonDisabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={
                value
                  ? "pencil"
                  : search.isPending
                    ? "hourglass-outline"
                    : "search"
              }
            />
          </Pressable>
        ) : null}
      </View>
      <ErrorText error={search.error || choose.error} />
      {search.isSuccess && !suggestions.length && !value ? (
        <Text style={ui.muted}>
          Không có kết quả. Thử nhập địa chỉ chi tiết hơn.
        </Text>
      ) : null}
      {suggestions.map((p) => (
        <Pressable
          accessibilityRole="button"
          disabled={choose.isPending || disabled}
          key={p.placeRef}
          onPress={() => choose.mutate(p.placeRef)}
          style={({ pressed }) => [
            styles.suggestion,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="location-outline" size={18} />
          <View style={styles.suggestionText}>
            <Text style={styles.suggestionTitle}>
              {p.mainText || p.displayLabel}
            </Text>
            <Text style={styles.suggestionMeta}>{p.secondaryText}</Text>
          </View>
          <Icon name="chevron-forward" size={18} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  compactBox: {
    minHeight: theme.destination.inputHeight,
    borderColor: theme.destination.accent,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingStart: theme.destination.rowSpacing,
    gap: theme.spacing.sm,
  },
  compactInput: {
    minHeight: theme.destination.inputHeight,
    fontSize: theme.destination.titleSize,
    color: theme.destination.ink,
    paddingVertical: theme.spacing.sm,
  },
  compactSearch: {
    minWidth: theme.journey.sheetHandleTarget,
    borderLeftWidth: 0,
  },
  disabled: { opacity: 0.45 },
  group: { gap: theme.spacing.sm },
  input: {
    color: theme.colors.ink,
    flex: 1,
    fontFamily: theme.font.regular,
    fontSize: 15,
    minHeight: 52,
    paddingVertical: theme.spacing.sm,
  },
  pressed: { opacity: 0.72 },
  searchBox: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 56,
    paddingStart: theme.spacing.md,
  },
  searchBoxSelected: { backgroundColor: theme.colors.surfaceMuted },
  searchButton: {
    alignItems: "center",
    alignSelf: "stretch",
    borderLeftColor: theme.colors.border,
    borderLeftWidth: 1,
    justifyContent: "center",
    minWidth: 56,
  },
  suggestion: {
    alignItems: "center",
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    minHeight: 64,
    paddingVertical: theme.spacing.sm,
  },
  suggestionMeta: { color: theme.colors.inkMuted, fontSize: 12 },
  suggestionText: { flex: 1, gap: theme.spacing.xs },
  suggestionTitle: { fontSize: 14, fontWeight: "700" },
});
