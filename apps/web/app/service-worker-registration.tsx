"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setUpdateReady(true);
          }
        });
      });
    });
  }, []);

  return updateReady ? (
    <button
      className="pwa-update"
      type="button"
      onClick={() => window.location.reload()}
    >
      Có phiên bản mới — tải lại
    </button>
  ) : null;
}
