import "@dike/design-tokens/styles.css";
import "./styles.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dike",
  description:
    "Nền tảng kết nối hành trình phù hợp theo tuyến đường và thời gian.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
