import { ArrowLeft, Inbox, type LucideIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "Quay lại",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="app-page-header">
      {backHref ? (
        <Link className="app-back-link" href={backHref}>
          <ArrowLeft aria-hidden="true" size={17} />
          {backLabel}
        </Link>
      ) : null}
      <div className="app-page-header-row">
        <div>
          {eyebrow ? <p className="app-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="app-page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="app-empty-state">
      <span className="app-empty-icon">
        <Icon aria-hidden="true" size={28} strokeWidth={1.7} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="app-empty-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  label = "Đang tải dữ liệu",
}: {
  label?: string;
}) {
  return (
    <div className="app-loading-state" role="status" aria-label={label}>
      <span className="app-skeleton app-skeleton--title" />
      <span className="app-skeleton" />
      <span className="app-skeleton app-skeleton--short" />
    </div>
  );
}

export function ErrorState({
  title = "Chưa thể tải nội dung",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="app-error-state" role="alert">
      <Sparkles aria-hidden="true" size={22} />
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button
          className="app-button app-button--secondary"
          type="button"
          onClick={onRetry}
        >
          Thử lại
        </button>
      ) : null}
    </div>
  );
}
