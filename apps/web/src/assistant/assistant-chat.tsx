"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../auth/api";
import { saveAssistantRideDraft } from "./ride-draft";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bot,
  MoreHorizontal,
  Minus,
  Trash2,
  ShieldCheck,
  Lightbulb,
  ChevronDown,
  CalendarPlus,
  CalendarDays,
  CalendarCheck,
  MapPin,
  ArrowRightLeft,
  FileText,
  BookmarkCheck,
  Search,
  LoaderCircle,
} from "lucide-react";
import {
  assistantSuggestions,
  assistantFields,
  assistantFieldKeys,
  assistantOptionLabels,
  type DikeAssistantConversation,
  type DikeAssistantDraft,
  type DikeAssistantReply,
  type DikeAssistantResult,
} from "@dike/api-client-ts";
import { assistantRequest } from "./api";
import { routingApi } from "../routing/client";
import type { PlaceResponse, PlaceSuggestionResponse } from "../routing/api";
import { statusName, dateTime } from "../rides/dashboard";

const quickItems = [
  { label: "Tạo chuyến đi", Icon: CalendarPlus },
  { label: "Tạo lịch định kỳ", Icon: CalendarDays },
  { label: "Cách tạo lịch", Icon: CalendarCheck },
  { label: "Cách đặt chỗ", Icon: MapPin },
  { label: "Cách hủy chuyến", Icon: ArrowRightLeft },
  { label: "Gửi báo cáo", Icon: FileText },
  { label: "Booking của tôi", Icon: BookmarkCheck },
];

export function AssistantChat({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const client = useQueryClient();
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
  const [busy, setBusy] = useState(false);
  const [rideVehicleMode, setRideVehicleMode] = useState<"MOTORBIKE" | "CAR">(
    "MOTORBIKE",
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldErrorId = useId();
  function clearFieldError(key: string) {
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }
  function showFieldErrors(errors: Record<string, string>) {
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (!first) return false;
    setError("");
    window.requestAnimationFrame(() => {
      const container = scroll.current;
      const wrapper = container?.querySelector<HTMLElement>(
        `[data-assistant-field="${first}"]`,
      );
      if (!container || !wrapper) return;
      container.scrollTop +=
        wrapper.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        140;
      wrapper
        .querySelector<HTMLElement>("input, select")
        ?.focus({ preventScroll: true });
    });
    return true;
  }
  const [result, setResult] = useState<DikeAssistantResult>();
  const scroll = useRef<HTMLDivElement>(null);
  const options = useRef<HTMLDetailsElement>(null);
  const quickActions = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!options.current?.contains(event.target as Node))
        options.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  useEffect(() => {
    const container = scroll.current;
    if (!container) return;
    const target = container.querySelector(
      draft ? ".assistant-draft" : ".assistant-messages article:last-child",
    );
    if (target)
      container.scrollTop +=
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top;
  }, [messages.length, draft]);

  async function send(value: string) {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError("");
    try {
      let id = conversation;
      if (!id) {
        const created = await assistantRequest<DikeAssistantConversation>("");
        id = created.id;
        setConversation(id);
      }
      const answer = await assistantRequest<DikeAssistantReply>(
        `/${id}/messages`,
        "POST",
        {
          text: value,
          ...(draft && !result ? { draftVersion: draft.version, fields } : {}),
        },
      );
      setMessages((previous) => [
        ...previous.slice(-19),
        { role: "Bạn", text: value },
        {
          role: "Dike",
          text:
            answer.draft?.kind === "INTENT" &&
            answer.draft.version !== draft?.version &&
            !answer.source
              ? "Kiểm tra bản nháp, chọn địa chỉ chính xác rồi bấm Tìm bài phù hợp và đăng bài để tới bước 3."
              : answer.text,
        },
      ]);
      setReply(answer);
      setText("");
      if (JSON.stringify(answer.draft) !== JSON.stringify(draft)) {
        setFieldErrors({});
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
        e instanceof Error ? e.message : "Không có kết nối. Hãy thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    const invalid: Record<string, string> = {};
    if (!origin)
      invalid.originQuery = "Tìm và chọn địa chỉ xuất phát chính xác.";
    if (!destination)
      invalid.destinationQuery = "Tìm và chọn địa chỉ đến chính xác.";
    for (const key of assistantFieldKeys(draft.kind).filter(
      (key) => key !== "buffer",
    )) {
      if (!fields[key]?.trim())
        invalid[key] = `Bổ sung ${assistantFields[key].label.toLowerCase()}.`;
    }
    if (fields.until && fields.date && fields.until < fields.date)
      invalid.until = "Ngày kết thúc phải từ ngày bắt đầu trở đi.";
    if (
      fields.startTime &&
      fields.endTime &&
      fields.endTime <= fields.startTime
    )
      invalid.endTime = "Giờ kết thúc phải sau giờ bắt đầu.";
    if (showFieldErrors(invalid) || !origin || !destination) return;
    setBusy(true);
    setError("");
    try {
      setResult(
        await assistantRequest<DikeAssistantResult>(
          `/${conversation}/confirm`,
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
      setBusy(false);
    }
  }

  async function continueToRide() {
    const session = client.getQueryData<
      Awaited<ReturnType<typeof authApi.session>>
    >(["auth", "session"]);
    if (!session?.user?.id) return;
    const invalid: Record<string, string> = {};
    if (!origin)
      invalid.originQuery = "Tìm và chọn địa chỉ xuất phát chính xác.";
    if (!destination)
      invalid.destinationQuery = "Tìm và chọn địa chỉ đến chính xác.";
    if (!fields.date) invalid.date = "Chọn ngày khởi hành.";
    if (!["RIDER", "DRIVER"].includes(fields.role))
      invalid.role = "Chọn vai trò đi ké hoặc tài xế.";
    if (!fields.departureTime) invalid.departureTime = "Nhập giờ khởi hành.";
    const time = new Date(`${fields.date}T${fields.departureTime}`).getTime();
    if (
      !Number.isFinite(time) ||
      time <= Date.now() ||
      time > Date.now() + 7 * 86400000
    ) {
      if (fields.date && fields.departureTime) {
        const day = new Date(`${fields.date}T23:59`).getTime();
        invalid[
          day < Date.now() || time > Date.now() + 7 * 86400000
            ? "date"
            : "departureTime"
        ] = "Chọn giờ khởi hành trong tương lai, trong vòng 7 ngày tới.";
      }
    }
    const seats = Number(fields.seats || "1");
    if (
      !Number.isInteger(seats) ||
      seats < 1 ||
      seats > (rideVehicleMode === "MOTORBIKE" ? 1 : 8)
    ) {
      invalid.seats = "Kiểm tra số chỗ: xe máy 1 chỗ, ô tô từ 1 đến 8 chỗ.";
    }
    if (showFieldErrors(invalid) || !origin || !destination) return;
    setBusy(true);
    setError("");
    try {
      const route = await routingApi.createRoute(
        origin.placeRef,
        destination.placeRef,
        rideVehicleMode,
      );
      const estimate = await routingApi.createEstimate(
        route.id,
        route.distanceMeters,
        seats,
      );
      const id = crypto.randomUUID();
      saveAssistantRideDraft(client, session.user.id, id, {
        fields: { ...fields },
        origin,
        destination,
        createdAt: Date.now(),
        route,
        estimate,
      });
      router.push(
        `/rides/new?mode=${fields.role === "DRIVER" ? "driver" : "passenger"}&assistantDraft=${id}`,
      );
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chưa tính được tuyến đường. Hãy thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError("");
    try {
      if (conversation) await assistantRequest(`/${conversation}`, "DELETE");
      setConversation(undefined);
      setMessages([]);
      setDraft(null);
      setReply(undefined);
      setFields({});
      setFieldErrors({});
      setResult(undefined);
      setOrigin(undefined);
      setDestination(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa xóa được hội thoại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assistant-page">
      <header className="assistant-widget-header">
        <div className="assistant-widget-identity">
          <span className="assistant-widget-avatar">
            <Bot size={21} aria-hidden="true" />
          </span>
          <div>
            <h2>Trợ lý Dike</h2>
            <p>Hỗ trợ hành trình của bạn</p>
          </div>
        </div>
        <div className="assistant-header-actions">
          <details
            className="assistant-options"
            ref={options}
            onKeyDown={(event) => {
              if (event.key === "Escape" && options.current?.open) {
                event.stopPropagation();
                options.current.removeAttribute("open");
                options.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label="Tùy chọn trợ lý" title="Tùy chọn trợ lý">
              <MoreHorizontal size={20} aria-hidden="true" />
            </summary>
            <div className="assistant-options-menu">
              <button
                disabled={busy}
                onClick={() => {
                  options.current?.removeAttribute("open");
                  void reset();
                }}
              >
                <Trash2 size={16} aria-hidden="true" /> Xóa hội thoại
              </button>
              <details className="assistant-privacy">
                <summary>
                  <ShieldCheck size={16} aria-hidden="true" /> Về trợ lý & quyền
                  riêng tư
                </summary>
                <p>
                  Nội dung nhập tự nhiên và bản nháp được xử lý bởi dịch vụ AI.
                  Không gửi giấy tờ, mã OTP hoặc thông tin thanh toán. Hội thoại
                  hết hạn sau 24 giờ. Bạn kiểm tra và xác nhận trước khi lưu.
                </p>
              </details>
            </div>
          </details>
          <button onClick={onClose} aria-label="Thu nhỏ khung chat">
            <Minus size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="assistant-layout" ref={scroll}>
        <section aria-label="Trò chuyện với trợ lý">
          <details className="assistant-quick-actions" ref={quickActions}>
            <summary>
              <span className="assistant-quick-symbol">
                <Lightbulb size={20} aria-hidden="true" />
              </span>
              <span className="assistant-quick-heading">
                <strong>Gợi ý nhanh</strong>
                <span>Chọn một gợi ý để bắt đầu nhanh hơn</span>
              </span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="assistant-suggestions">
              {assistantSuggestions.map((value, index) => {
                const { label, Icon } = quickItems[index];
                return (
                  <button
                    key={value}
                    aria-label={value}
                    disabled={busy}
                    onClick={() => {
                      quickActions.current?.removeAttribute("open");
                      setText(value);
                      void send(value);
                    }}
                  >
                    <span className="assistant-quick-icon">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="assistant-quick-label">{label}</span>
                  </button>
                );
              })}
            </div>
          </details>
          <div className="assistant-messages" role="log" aria-live="polite">
            {messages.length === 0 && (
              <p>
                Bạn muốn đi đâu, vào lúc nào? Nhắn cho mình hoặc mở Gợi ý nhanh
                để bắt đầu.
              </p>
            )}
            {messages.map((message, i) => (
              <article
                key={i}
                className={
                  message.role === "Bạn" ? "assistant-user" : "assistant-answer"
                }
              >
                <strong>{message.role}</strong>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
          {busy && <p role="status">Đang xử lý…</p>}
          {error && (
            <p className="assistant-error" role="alert">
              {error}
            </p>
          )}
          {reply?.checkedAt && (
            <aside className="assistant-card">
              <h2>Booking của bạn</h2>
              <p>Cập nhật {dateTime(reply.checkedAt)}</p>
              {reply.bookings.length === 0 ? (
                <p>Bạn chưa có booking.</p>
              ) : (
                reply.bookings.map((booking) => (
                  <p key={booking.id}>
                    <Link href={`/bookings/${encodeURIComponent(booking.id)}`}>
                      {booking.id.slice(0, 12)}
                    </Link>{" "}
                    · {statusName(booking.status)} ·{" "}
                    {booking.pickupAt
                      ? dateTime(booking.pickupAt)
                      : "Chưa có giờ đón"}
                  </p>
                ))
              )}
            </aside>
          )}
        </section>
        {draft && (
          <aside
            className="assistant-card assistant-draft"
            onChangeCapture={(event) => {
              const key = (event.target as HTMLElement).closest<HTMLElement>(
                "[data-assistant-field]",
              )?.dataset.assistantField;
              if (key) clearFieldError(key);
            }}
          >
            <h2>
              {draft
                ? draft.kind === "SCHEDULE"
                  ? "Bản nháp lịch định kỳ"
                  : "Bản nháp chuyến đi"
                : "Bản nháp của bạn"}
            </h2>
            {!draft && (
              <p>
                Mô tả lịch hoặc nhu cầu để bắt đầu. Chatbot sẽ hỏi những thông
                tin còn thiếu.
              </p>
            )}
            {draft && !result && (
              <>
                <p>
                  {draft.kind === "SCHEDULE"
                    ? "Múi giờ Việt Nam · Lưu lịch riêng tư, chưa đăng bài hoặc đặt chỗ."
                    : "Tự tính tuyến đường và mở bước tìm bài phù hợp. Bạn kiểm tra rồi bấm Đăng bài."}
                  {fields.seats ? ` Số chỗ mong muốn: ${fields.seats}.` : ""}
                </p>
                <PlaceChoice
                  key={`origin-${draft.version}`}
                  label="Nơi xuất phát"
                  hint={fields.originQuery}
                  value={origin}
                  onChange={(place) => {
                    setOrigin(place);
                    clearFieldError("originQuery");
                  }}
                  onError={(message) =>
                    message
                      ? showFieldErrors({ originQuery: message })
                      : setError("")
                  }
                  fieldKey="originQuery"
                  error={fieldErrors.originQuery}
                  disabled={busy}
                />
                <PlaceChoice
                  key={`destination-${draft.version}`}
                  label="Nơi đến / học / làm"
                  hint={fields.destinationQuery}
                  value={destination}
                  onChange={(place) => {
                    setDestination(place);
                    clearFieldError("destinationQuery");
                  }}
                  onError={(message) =>
                    message
                      ? showFieldErrors({ destinationQuery: message })
                      : setError("")
                  }
                  fieldKey="destinationQuery"
                  error={fieldErrors.destinationQuery}
                  disabled={busy}
                />
                <fieldset disabled={busy}>
                  {assistantFieldKeys(draft.kind)
                    .filter(
                      (key) =>
                        draft.kind === "SCHEDULE" || key !== "arrivalTime",
                    )
                    .map((key) => {
                      const field = assistantFields[key];
                      if (key === "weekdays")
                        return (
                          <fieldset
                            key={key}
                            className="assistant-weekdays"
                            data-assistant-field={key}
                            aria-invalid={Boolean(fieldErrors[key])}
                          >
                            <legend>{field.label}</legend>
                            {fieldErrors[key] && (
                              <small className="assistant-field-error">
                                {fieldErrors[key]}
                              </small>
                            )}
                            {field.options?.map((day) => (
                              <label key={day}>
                                <input
                                  type="checkbox"
                                  checked={(fields.weekdays ?? "")
                                    .split(",")
                                    .includes(day)}
                                  onChange={(event) => {
                                    const days = (fields.weekdays ?? "")
                                      .split(",")
                                      .filter(Boolean);
                                    setFields({
                                      ...fields,
                                      weekdays: (event.target.checked
                                        ? [...days, day]
                                        : days.filter((value) => value !== day)
                                      ).join(","),
                                    });
                                  }}
                                />
                                {assistantOptionLabels[day]}
                              </label>
                            ))}
                          </fieldset>
                        );
                      return (
                        <label key={key} data-assistant-field={key}>
                          {field.label}
                          {field.options ? (
                            <select
                              aria-invalid={Boolean(fieldErrors[key])}
                              aria-describedby={
                                fieldErrors[key]
                                  ? `${fieldErrorId}-${key}`
                                  : undefined
                              }
                              value={fields[key] ?? ""}
                              onChange={(e) =>
                                setFields({ ...fields, [key]: e.target.value })
                              }
                            >
                              <option value="">Chọn…</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {assistantOptionLabels[option] ?? option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              aria-invalid={Boolean(fieldErrors[key])}
                              aria-describedby={
                                fieldErrors[key]
                                  ? `${fieldErrorId}-${key}`
                                  : undefined
                              }
                              type={field.type ?? "text"}
                              value={fields[key] ?? ""}
                              onChange={(e) =>
                                setFields({ ...fields, [key]: e.target.value })
                              }
                            />
                          )}
                          {fieldErrors[key] && (
                            <small
                              id={`${fieldErrorId}-${key}`}
                              className="assistant-field-error"
                            >
                              {fieldErrors[key]}
                            </small>
                          )}
                        </label>
                      );
                    })}
                </fieldset>
                {draft.kind === "INTENT" && (
                  <fieldset disabled={busy}>
                    <label data-assistant-field="vehicleMode">
                      Phương tiện
                      <select
                        value={rideVehicleMode}
                        onChange={(e) =>
                          setRideVehicleMode(
                            e.target.value as "MOTORBIKE" | "CAR",
                          )
                        }
                      >
                        <option value="MOTORBIKE">Xe máy</option>
                        <option value="CAR">Ô tô</option>
                      </select>
                    </label>
                    <label data-assistant-field="seats">
                      Số chỗ
                      <input
                        aria-invalid={Boolean(fieldErrors.seats)}
                        aria-describedby={
                          fieldErrors.seats
                            ? `${fieldErrorId}-seats`
                            : undefined
                        }
                        type="number"
                        min={1}
                        max={rideVehicleMode === "MOTORBIKE" ? 1 : 8}
                        value={fields.seats ?? "1"}
                        onChange={(e) =>
                          setFields({ ...fields, seats: e.target.value })
                        }
                      />
                      {fieldErrors.seats && (
                        <small
                          id={`${fieldErrorId}-seats`}
                          className="assistant-field-error"
                        >
                          {fieldErrors.seats}
                        </small>
                      )}
                    </label>
                  </fieldset>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    draft.kind === "SCHEDULE"
                      ? void confirm()
                      : continueToRide()
                  }
                >
                  {draft.kind === "SCHEDULE"
                    ? "Xác nhận lưu lịch"
                    : busy
                      ? "Đang tính tuyến đường…"
                      : "Tìm bài phù hợp và đăng bài"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void send("Bỏ bản nháp")}
                >
                  Bỏ bản nháp
                </button>
              </>
            )}
            {result && (
              <div role="status">
                <h3>Đã lưu thành công</h3>
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
                {result.kind === "SCHEDULE" ? (
                  <Link href={`/schedules/${encodeURIComponent(result.id)}`}>
                    Mở lịch đã lưu
                  </Link>
                ) : (
                  <button onClick={continueToRide}>
                    Tiếp tục tạo chuyến / bài đăng
                  </button>
                )}
                <p>Lưu lịch/nhu cầu chưa tạo booking.</p>
              </div>
            )}
          </aside>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(text);
        }}
        className="assistant-composer"
      >
        <label htmlFor="assistant-message">Tin nhắn của bạn</label>
        <div className="assistant-composer-row">
          <textarea
            id="assistant-message"
            value={text}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
            placeholder="Nhắn cho Dike…"
            disabled={busy}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send(text);
              }
            }}
          />
          <button
            disabled={busy || !text.trim()}
            type="submit"
            aria-label="Gửi tin nhắn"
          >
            Gửi
          </button>
        </div>
      </form>
    </div>
  );
}

function PlaceChoice({
  label,
  hint,
  value,
  onChange,
  disabled,
  onError,
  fieldKey,
  error,
}: {
  label: string;
  hint?: string;
  value?: PlaceResponse;
  onChange: (value?: PlaceResponse) => void;
  disabled: boolean;
  onError: (message: string) => void;
  fieldKey: string;
  error?: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(hint ?? "");
  const [session, setSession] = useState<string>();
  const [items, setItems] = useState<PlaceSuggestionResponse[]>([]);
  const setError = onError;
  const [pending, setPending] = useState(false);
  async function search() {
    setPending(true);
    setError("");
    try {
      const current = await routingApi.createPlaceSession();
      setSession(current.sessionToken);
      const found = await routingApi.autocompletePlaces(
        current.sessionToken,
        query,
      );
      setItems(found);
      if (!found.length)
        setError(
          "Chưa tìm thấy địa chỉ. Thử nhập tên đường, quận hoặc thành phố cụ thể hơn.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa tìm được địa chỉ.");
    } finally {
      setPending(false);
    }
  }
  async function choose(ref: string) {
    if (!session) return;
    setPending(true);
    setError("");
    try {
      onChange(await routingApi.resolvePlace(session, ref));
      setItems([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Địa chỉ hết hạn, hãy tìm lại.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="assistant-place" data-assistant-field={fieldKey}>
      <label htmlFor={inputId}>{label}</label>
      <div className="assistant-place-field">
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          value={value?.displayLabel ?? query}
          disabled={disabled || pending}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(undefined);
            setItems([]);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!disabled && !pending && query.trim().length >= 2)
                void search();
            }
          }}
        />
        <button
          type="button"
          className="assistant-place-search"
          aria-label="Tìm địa chỉ chính xác"
          title="Tìm địa chỉ"
          aria-busy={pending}
          disabled={disabled || pending || query.trim().length < 2}
          onClick={() => void search()}
        >
          {pending ? (
            <LoaderCircle
              size={18}
              className="assistant-place-spinner"
              aria-hidden="true"
            />
          ) : (
            <Search size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <small id={`${inputId}-error`} className="assistant-field-error">
          {error}
        </small>
      )}
      {items.map((item) => (
        <button
          key={item.placeRef}
          disabled={disabled || pending}
          onClick={() => void choose(item.placeRef)}
        >
          {item.displayLabel}
        </button>
      ))}
    </div>
  );
}
