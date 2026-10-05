import { Button, Card, Status } from "@dike/web-ui";

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav" aria-label="Điều hướng chính">
        <a className="brand" href="#top" aria-label="Dike — Trang đầu">
          <span className="brand__mark" aria-hidden="true">
            D
          </span>
          <span>Dike</span>
        </a>
        <a className="stage-badge" href="/login">
          Đăng nhập
        </a>
      </nav>

      <section className="hero" id="top">
        <p className="eyebrow">Đi cùng tuyến, đúng thời gian</p>
        <h1>Nền tảng cho những hành trình thuận đường.</h1>
        <p className="hero__copy">
          App shell đã sẵn sàng. Các luồng đăng nhập, lịch, chuyến đi và kết nối
          cộng đồng sẽ được mở theo từng giai đoạn đã kiểm chứng.
        </p>
        <div className="hero__actions" aria-label="Trạng thái nền tảng">
          <Button type="button">Nền tảng đang được xây dựng</Button>
          <span>Web responsive · API contract-first · Dữ liệu riêng tư</span>
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">Urban Mint foundation</p>
          <h2 id="foundation-title">Sẵn sàng cho lát cắt nghiệp vụ đầu tiên</h2>
        </div>
        <ul>
          <li>Giao diện tối ưu màn hình điện thoại</li>
          <li>Backend module hóa với hợp đồng rõ ràng</li>
          <li>Trạng thái thật luôn được đồng bộ từ API</li>
        </ul>
      </section>

      <section className="states" aria-labelledby="states-title">
        <div>
          <p className="eyebrow">Trạng thái giao diện chuẩn</p>
          <h2 id="states-title">Rõ ràng cả khi chưa có dữ liệu</h2>
        </div>
        <div className="states__grid">
          <Card aria-label="Trạng thái đang tải">
            <Status>Đang tải</Status>
            <p>Đang kết nối với dịch vụ Dike…</p>
          </Card>
          <Card aria-label="Trạng thái trống">
            <Status tone="success">Sẵn sàng</Status>
            <p>Chưa có dữ liệu để hiển thị.</p>
          </Card>
          <Card aria-label="Trạng thái mất kết nối">
            <Status tone="danger">Ngoại tuyến</Status>
            <p>Kiểm tra kết nối rồi thử lại.</p>
            <Button type="button" variant="secondary">
              Thử lại
            </Button>
          </Card>
        </div>
      </section>
    </main>
  );
}
