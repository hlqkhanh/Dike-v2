"use client";

import Image from "next/image";
import { useState } from "react";

export function MemberAvatar({
  name,
  avatarUrl,
  className,
  size = 40,
}: {
  name: string;
  avatarUrl?: string | null;
  className: string;
  size?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi-VN");

  return (
    <span className={className} aria-hidden="true">
      {avatarUrl && failedUrl !== avatarUrl ? (
        <Image
          unoptimized
          className="member-avatar-image"
          src={avatarUrl}
          width={size}
          height={size}
          alt=""
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : (
        initials || "DK"
      )}
    </span>
  );
}
