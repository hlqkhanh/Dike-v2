import type { HTMLAttributes } from "react";

export function Card(props: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={`dike-card ${props.className ?? ""}`.trim()}
    />
  );
}
