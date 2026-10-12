import Image from "next/image";

export function DikeLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-logo-wrap ${className}`}>
      <Image
        src="/images/logo.png"
        alt="Logo Diké"
        className="brand-logo-img"
        width={38}
        height={38}
        priority
      />
      <span className="brand-logo-text">Diké</span>
    </span>
  );
}
