import type { HTMLAttributes, ReactNode } from "react";

export type LayoutShellProps = HTMLAttributes<HTMLDivElement> & {
  header: ReactNode;
};

export function LayoutShell({ header, children, ...props }: LayoutShellProps) {
  return (
    <div {...props} className={`dike-layout ${props.className ?? ""}`.trim()}>
      <header>{header}</header>
      <main>{children}</main>
    </div>
  );
}
