import Image from "next/image";

export function DikeLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-logo-wrap ${className}`}>
      <Image
        src="/images/dike_logo_clean.png"
        alt="DIKÉ SHARE"
        className="brand-logo-img"
        width={180}
        height={48}
        style={{ height: "2.35rem", width: "auto", display: "block" }}
      />
    </span>
  );
}
