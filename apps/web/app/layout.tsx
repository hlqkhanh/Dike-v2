import "@dike/design-tokens/styles.css";
import "./styles.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "DIKÉ SHARE — Chuyến đi xanh của bạn",
  description:
    "Đi chung xe cùng cộng đồng, chia sẻ chuyến đi với bạn bè và cùng nhau di chuyển bền vững.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
