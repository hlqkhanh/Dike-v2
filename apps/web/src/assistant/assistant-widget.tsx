"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { authApi } from "../auth/api";
import { AssistantChat } from "./assistant-chat";
import "../../app/assistant/assistant.css";

export function AssistantWidget() {
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    enabled: false,
  });
  const userId = session.data?.authenticated
    ? session.data.user?.id
    : undefined;
  return userId ? <ChatBubble key={userId} /> : null;
}

function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("assistant") === "open"
    ) {
      const frame = window.requestAnimationFrame(() => {
        setMounted(true);
        setOpen(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    panel.current
      ?.querySelector<HTMLTextAreaElement>("textarea")
      ?.focus({ preventScroll: true });
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcher.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);

  function close() {
    setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  }

  return (
    <div className="assistant-widget">
      {mounted && (
        <section
          ref={panel}
          id="dike-assistant-panel"
          role="dialog"
          aria-label="Trợ lý Dike"
          aria-modal="false"
          hidden={!open}
          className="assistant-popover"
        >
          <AssistantChat onClose={close} />
        </section>
      )}
      <button
        ref={launcher}
        className="assistant-launcher"
        aria-label={open ? "Đóng trợ lý Dike" : "Mở trợ lý Dike"}
        aria-expanded={open}
        aria-controls={mounted ? "dike-assistant-panel" : undefined}
        onClick={() => {
          if (open) close();
          else {
            setMounted(true);
            setOpen(true);
          }
        }}
      >
        {open ? (
          <X size={26} aria-hidden="true" />
        ) : (
          <MessageCircle size={28} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
