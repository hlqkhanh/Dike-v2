import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <p className="eyebrow">DIKÉ SHARE</p>
      <h1>Bạn đang ngoại tuyến</h1>
      <p>
        Dike không lưu dữ liệu tài khoản trên thiết bị. Hãy kết nối mạng rồi thử
        lại.
      </p>
      <Link className="stage-badge stage-badge--cta" href="/">
        Thử kết nối lại
      </Link>
    </main>
  );
}
