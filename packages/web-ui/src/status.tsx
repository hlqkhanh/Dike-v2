import type { HTMLAttributes } from "react";

export type StatusProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "danger";
};

export function Status({ tone = "neutral", ...props }: StatusProps) {
  return (
    <span
      {...props}
      className={`dike-status dike-status--${tone} ${props.className ?? ""}`.trim()}
    />
  );
}
