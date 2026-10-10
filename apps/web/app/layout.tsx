import "@dike/design-tokens/styles.css";
import "./styles.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import { ServiceWorkerRegistration } from "./service-worker-registration";
import { AppShell } from "./components/app-shell";

export const metadata: Metadata = {
  title: "DIKÉ SHARE — Chuyến đi xanh của bạn",
  description:
    "Đi chung xe cùng cộng đồng, chia sẻ chuyến đi với bạn bè và cùng nhau di chuyển bền vững.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Chuyển đến nội dung chính
        </a>
        <div id="main-content" tabIndex={-1}>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
