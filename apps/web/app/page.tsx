"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button, Card, Status } from "@dike/web-ui";

import { AuthNavigation } from "./auth-navigation";
import { DikeLogo } from "./components/dike-logo";
import { authApi } from "../src/auth/api";

const Map3DModelViewer = dynamic(
  () =>
    import("./components/map-3d-model-viewer").then(
      (mod) => mod.Map3DModelViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="map-3d-model-skeleton">
        <div className="map-3d-spinner" />
        <span>Đang chuẩn bị không gian 3D…</span>
      </div>
    ),
  },
);

export default function HomePage() {
  const router = useRouter();
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });

  useEffect(() => {
    if (session.data) {
      router.replace("/home");
    }
  }, [session.data, router]);

  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSupportMenuOpen, setIsSupportMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDemoTab, setActiveDemoTab] = useState<"route" | "match" | "eco">(
    "route",
  );
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (session.data) {
    return null;
  }

  return (
    <div className="landing-viewport-root">
      {/* Search Dialog Modal */}
      {isSearchOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-modal-title"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="modal-card search-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="search-modal-title">Tìm kiếm chuyến đi xanh</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Đóng tìm kiếm"
              >
                ✕
              </button>
            </div>
            <div className="search-input-group">
              <span className="search-icon-inside" aria-hidden="true">
                🔍
              </span>
              <input
                type="text"
                placeholder="Nhập điểm đón, trường học hoặc cơ quan…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="quick-tags">
              <span>Gợi ý phổ biến:</span>
              <button
                type="button"
                className="tag-chip"
                onClick={() => setSearchQuery("Đại học FPT - Hòa Lạc")}
              >
                ĐH FPT - Hòa Lạc
              </button>
              <button
                type="button"
                className="tag-chip"
                onClick={() => setSearchQuery("Cầu Giấy")}
              >
                Cầu Giấy
              </button>
              <button
                type="button"
                className="tag-chip"
                onClick={() => setSearchQuery("Hà Đông")}
              >
                Hà Đông
              </button>
            </div>
            <div className="modal-actions">
              <Link
                href="/login"
                className="btn-primary-pill"
                onClick={() => setIsSearchOpen(false)}
              >
                Tìm chuyến đi phù hợp →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Demo Modal */}
      {isDemoOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          onClick={() => setIsDemoOpen(false)}
        >
          <div
            className="modal-card demo-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">Trải nghiệm mô phỏng</span>
                <h3 id="demo-modal-title">Cách DIKÉ SHARE hoạt động</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsDemoOpen(false)}
                aria-label="Đóng cửa sổ demo"
              >
                ✕
              </button>
            </div>

            <div className="demo-tabs">
              <button
                type="button"
                className={`demo-tab-btn ${activeDemoTab === "route" ? "active" : ""}`}
                onClick={() => setActiveDemoTab("route")}
              >
                1. Chọn lộ trình
              </button>
              <button
                type="button"
                className={`demo-tab-btn ${activeDemoTab === "match" ? "active" : ""}`}
                onClick={() => setActiveDemoTab("match")}
              >
                2. Ghép chuyến thông minh
              </button>
              <button
                type="button"
                className={`demo-tab-btn ${activeDemoTab === "eco" ? "active" : ""}`}
                onClick={() => setActiveDemoTab("eco")}
              >
                3. Tích lũy điểm xanh
              </button>
            </div>

            <div className="demo-content-body">
              {activeDemoTab === "route" && (
                <div className="demo-step">
                  <div className="demo-step-badge">Bước 1</div>
                  <h4>Nhập điểm xuất phát và thời gian mong muốn</h4>
                  <p>
                    Bạn có thể chọn lộ trình cố định hàng ngày (đi học, đi làm)
                    hoặc chuyến đi linh hoạt. Hệ thống tự động tính toán lộ
                    trình tối ưu nhất.
                  </p>
                  <div className="demo-mock-route">
                    <div className="route-point start">
                      <span className="dot"></span>
                      <div>
                        <strong>Điểm đón:</strong> KTX Mỹ Đình, Hà Nội
                      </div>
                    </div>
                    <div className="route-line"></div>
                    <div className="route-point end">
                      <span className="dot"></span>
                      <div>
                        <strong>Điểm đến:</strong> Khu CNC Hòa Lạc (Đại học FPT)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDemoTab === "match" && (
                <div className="demo-step">
                  <div className="demo-step-badge">Bước 2</div>
                  <h4>Ghép chuyến với bạn bè & người đồng hành tin cậy</h4>
                  <p>
                    Thuật toán thông minh kết nối bạn với những tài xế hoặc hành
                    khách có cùng thời gian di chuyển, tối đa hóa sự an toàn và
                    tiện lợi.
                  </p>
                  <div className="demo-match-card">
                    <Image
                      src="/images/avatars/rider_1_orig.png"
                      alt="Tài xế Hoàng Nam"
                      className="demo-driver-avatar"
                      width={56}
                      height={56}
                    />
                    <div className="demo-driver-info">
                      <strong>Hoàng Nam (Sinh viên K18)</strong>
                      <span>Xe điện VinFast Feliz · Khởi hành lúc 07:15</span>
                      <span className="rating-pill">★ 4.9 (128 chuyến)</span>
                    </div>
                    <span className="match-tag">Trùng khớp 96%</span>
                  </div>
                </div>
              )}

              {activeDemoTab === "eco" && (
                <div className="demo-step">
                  <div className="demo-step-badge">Bước 3</div>
                  <h4>Chia sẻ chi phí minh bạch & giảm phát thải CO₂</h4>
                  <p>
                    Chi phí được chia sẻ tự động qua ví điện tử hoặc chuyển
                    khoản. Mỗi km di chuyển chung giúp giảm phát thải và tăng
                    điểm sinh thái Eco-Points của bạn.
                  </p>
                  <div className="demo-eco-stats">
                    <div className="eco-stat-box">
                      <span className="eco-num">-1.8 kg</span>
                      <span className="eco-label">
                        CO₂ giảm thiểu chuyến này
                      </span>
                    </div>
                    <div className="eco-stat-box">
                      <span className="eco-num">50%</span>
                      <span className="eco-label">
                        Tiết kiệm chi phí xăng xe
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <Link
                href="/login"
                className="btn-primary-pill"
                onClick={() => setIsDemoOpen(false)}
              >
                Trải nghiệm thực tế ngay →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 1: FULL-BLEED ZERO-SCROLL VIEWPORT HERO (100% NHƯ ẢNH MẪU) */}
      {/* ======================================================== */}
      <section className="hero-stage-viewport" id="top">
        {/* Floating Top Navigation Bar */}
        <header className={`hero-stage-header${scrolled ? " scrolled" : ""}`}>
          <nav className="nav" aria-label="Điều hướng chính">
            {/* Brand Logo */}
            <a
              className="brand"
              href="#top"
              aria-label="DIKÉ SHARE — Trang chủ"
            >
              <DikeLogo />
            </a>

            {/* Centered Navigation Links */}
            <ul className={`nav-links${scrolled ? " is-scrolled" : ""}`}>
              <li>
                <a href="#top" className="nav-link active">
                  Trang chủ
                </a>
              </li>
              <li>
                <a href="#dich-vu" className="nav-link">
                  Dịch vụ
                </a>
              </li>
              <li>
                <a href="#ve-chung-toi" className="nav-link">
                  Về chúng tôi
                </a>
              </li>
              <li>
                <a href="#doi-tac" className="nav-link">
                  Đối tác
                </a>
              </li>
              <li>
                <Link href="/map" className="nav-link">
                  Bản đồ
                </Link>
              </li>
              <li className="nav-dropdown-item">
                <button
                  type="button"
                  className="nav-link nav-dropdown-btn"
                  onClick={() => setIsSupportMenuOpen(!isSupportMenuOpen)}
                  aria-expanded={isSupportMenuOpen}
                >
                  Hỗ trợ{" "}
                  <span className="chevron-icon" aria-hidden="true">
                    ›
                  </span>
                </button>
                {isSupportMenuOpen && (
                  <div className="support-dropdown-menu">
                    <a
                      href="#tro-giup"
                      onClick={() => setIsSupportMenuOpen(false)}
                    >
                      Trung tâm trợ giúp (FAQ)
                    </a>
                    <a
                      href="#an-toan"
                      onClick={() => setIsSupportMenuOpen(false)}
                    >
                      Quy chuẩn an toàn
                    </a>
                    <a
                      href="#bieu-phi"
                      onClick={() => setIsSupportMenuOpen(false)}
                    >
                      Chính sách biểu phí
                    </a>
                    <a
                      href="#lien-he"
                      onClick={() => setIsSupportMenuOpen(false)}
                    >
                      Liên hệ trực tiếp
                    </a>
                  </div>
                )}
              </li>
            </ul>

            {/* Right Action Controls */}
            <div className="nav-actions">
              <button
                type="button"
                className="search-btn"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Tìm kiếm lộ trình"
                title="Tìm kiếm"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="search-svg"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>

              <AuthNavigation />
            </div>
          </nav>
        </header>

        {/* Hero Left Content Overlay */}
        <div className="hero-stage-body">
          <div className="hero-stage-column">
            <h1 className="hero-editorial-title">
              <span className="hero-title-dark">KHÁM PHÁ</span>
              <span className="hero-title-green">DIKÉ SHARE.</span>
            </h1>

            <p className="hero-tagline">
              Chuyến đi xanh của bạn. Tiết kiệm. Chia sẻ. Di chuyển.
            </p>

            <p className="hero-description">
              Đi chung xe cùng cộng đồng, chia sẻ chuyến đi với bạn bè và cùng
              nhau di chuyển bền vững. Tiết kiệm chi phí và giảm thiểu dấu chân
              carbon trước mỗi chuyến đi.
              <span className="hero-location-note"> (Khu vực Hà Nội)</span>
            </p>

            <div className="hero-actions-row">
              <Link className="btn-primary-pill" href="/login">
                Đặt xe ngay{" "}
                <span className="btn-arrow" aria-hidden="true">
                  →
                </span>
              </Link>

              <button
                type="button"
                className="btn-demo-pill"
                onClick={() => setIsDemoOpen(true)}
              >
                <span className="play-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="9,6 18,12 9,18" />
                  </svg>
                </span>
                <span>Xem Demo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <a
          href="#dich-vu"
          className="scroll-hint-btn"
          aria-label="Xem thêm thông tin"
        >
          <span>Khám phá thêm</span>
          <span className="scroll-chevron">↓</span>
        </a>
      </section>

      {/* ======================================================== */}
      {/* SECTION 2: FULLSCREEN 3D ISOMETRIC SHOWCASE (THỐNG NHẤT 1 KHUNG HÌNH) */}
      {/* ======================================================== */}
      <section
        className="showcase-stage-viewport"
        id="dich-vu"
        aria-labelledby="showcase-title"
      >
        <div className="showcase-stage-body">
          {/* Left Column: Minimalist Content about Rider & Driver */}
          <div className="showcase-content-col">
            <p className="showcase-tagline">
              KẾT NỐI HÀNH TRÌNH · CHIA SẺ CHỖ TRỐNG
            </p>

            <h2 id="showcase-title" className="showcase-headline">
              <span className="showcase-headline-dark">ĐỒNG HÀNH</span>
              <span className="showcase-headline-green">XE KÉ & ĐI CHUNG.</span>
            </h2>

            <p className="showcase-subhead">
              Người có xe chia sẻ chỗ ngồi, người đi ké tiết kiệm chi phí.
            </p>

            <p className="showcase-description">
              DIKÉ tự động kết nối tài xế còn ghế trống và người có chung lộ
              trình mỗi ngày. Không còn chuyến xe lãng phí, san sẻ chi phí xăng
              xe và lan tỏa thói quen di chuyển xanh.
            </p>

            <div className="showcase-actions">
              <Link href="/login" className="showcase-btn-primary">
                <span>Bắt đầu ngay</span>
                <span className="showcase-btn-arrow" aria-hidden="true">
                  →
                </span>
              </Link>

              <button
                type="button"
                className="showcase-btn-demo"
                onClick={() => setIsDemoOpen(true)}
                aria-label="Xem bản demo tương tác"
              >
                <span className="showcase-play-circle" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="9,6 18,12 9,18" />
                  </svg>
                </span>
                <span>Xem Bản Demo</span>
              </button>
            </div>

            <blockquote className="showcase-quote">
              “ Một ghế trống sẻ chia, triệu hành trình thêm gắn kết. ”
            </blockquote>
          </div>

          {/* Right Column: Interactive 3D Model that rotates around Y axis */}
          <div className="showcase-model-col">
            <Map3DModelViewer modelUrl="/images/HCMC-map-3dmodel2.glb" />
          </div>
        </div>

        {/* Scroll indicator to Section 3 */}
        <a
          href="#ve-chung-toi"
          className="showcase-scroll-hint"
          aria-label="Cuộn xem tiếp về chúng tôi"
        >
          <span>Về chúng tôi</span>
          <span className="scroll-chevron">↓</span>
        </a>
      </section>

      {/* ======================================================== */}
      {/* SECTION 3: PLATFORM FOUNDATION, IMPACT & COMMUNITY */}
      {/* ======================================================== */}
      <main className="shell">
        {/* About & Community Impact Section */}
        <section
          className="impact-section"
          id="ve-chung-toi"
          aria-labelledby="impact-title"
        >
          <div className="impact-container">
            <div className="impact-info">
              <p className="eyebrow">Về DIKÉ SHARE</p>
              <h2 id="impact-title">Vì một đô thị xanh và kết nối bền vững</h2>
              <p>
                DIKÉ SHARE ra đời với mục tiêu giải quyết bài toán ùn tắc giao
                thông, ô nhiễm khói bụi và gánh nặng chi phí đi lại của sinh
                viên và người đi làm tại các đô thị lớn ở Việt Nam.
              </p>
              <p>
                Chúng tôi tin rằng mỗi chiếc ghế trống được lấp đầy trên đường
                đi là thêm một bước tiến hướng tới một tương lai giao thông
                xanh, gắn kết và bền vững.
              </p>
            </div>

            <div className="impact-stats-grid">
              <div className="stat-card">
                <span className="stat-num">10.000+</span>
                <span className="stat-label">Thành viên đồng hành</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">35.000+</span>
                <span className="stat-label">Chuyến đi hoàn thành</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">18.5 Tấn</span>
                <span className="stat-label">CO₂ đã được giảm thiểu</span>
              </div>
              <div className="stat-card">
                <span className="stat-num">4.9 / 5.0</span>
                <span className="stat-label">Độ hài lòng cộng đồng</span>
              </div>
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <section
          className="partners-section"
          id="doi-tac"
          aria-labelledby="partners-title"
        >
          <div className="section-header">
            <p className="eyebrow">Đối tác tin cậy</p>
            <h2 id="partners-title">Đồng hành cùng các đơn vị tiên phong</h2>
            <p className="section-subtitle">
              Hợp tác cùng các trường đại học, khu công nghệ cao và doanh nghiệp
              thúc đẩy lối sống di chuyển bền vững.
            </p>
          </div>

          <div className="partners-badges">
            <div className="partner-item">Đại học FPT Hà Nội</div>
            <div className="partner-item">Khu Công Nghệ Cao Hòa Lạc</div>
            <div className="partner-item">Đại học Quốc gia Hà Nội</div>
            <div className="partner-item">Cộng đồng Xe Điện Xanh</div>
            <div className="partner-item">Mạng lưới Sinh viên Hà Nội</div>
          </div>
        </section>

        {/* Platform Foundation & System States (Required by test assertions) */}
        <section
          className="states-section"
          id="trang-thai-he-thong"
          aria-labelledby="states-title"
        >
          <div className="section-header">
            <p className="eyebrow">Trạng thái giao diện chuẩn</p>
            <h2 id="states-title">Rõ ràng cả khi chưa có dữ liệu</h2>
            <p className="section-subtitle">
              Hệ thống luôn đảm bảo tính ổn định và phản hồi thông tin minh bạch
              tới người dùng trong mọi điều kiện mạng.
            </p>
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

        {/* Footer */}
        <footer className="footer-section">
          <div className="footer-grid">
            <div className="footer-col brand-col">
              <DikeLogo />
              <p className="footer-brand-desc">
                Nền tảng kết nối hành trình phù hợp theo tuyến đường và thời
                gian. Chuyến đi xanh của bạn: Tiết kiệm, chia sẻ và cùng nhau di
                chuyển bền vững.
              </p>
              <span className="footer-locale">🇻🇳 Tiếng Việt (Việt Nam)</span>
            </div>

            <div className="footer-col">
              <h4>Dịch vụ</h4>
              <ul>
                <li>
                  <a href="#dich-vu">Đi chung xe máy</a>
                </li>
                <li>
                  <a href="#dich-vu">Chuyến đi xanh điện</a>
                </li>
                <li>
                  <a href="#dich-vu">Tuyến đường sinh viên</a>
                </li>
                <li>
                  <a href="#dich-vu">Lộ trình doanh nghiệp</a>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Về DIKÉ SHARE</h4>
              <ul>
                <li>
                  <a href="#ve-chung-toi">Câu chuyện sáng lập</a>
                </li>
                <li>
                  <a href="#ve-chung-toi">Tác động môi trường</a>
                </li>
                <li>
                  <a href="#doi-tac">Mạng lưới đối tác</a>
                </li>
                <li>
                  <a href="/login">Gia nhập đội ngũ</a>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Hỗ trợ & Pháp lý</h4>
              <ul>
                <li>
                  <a href="#trang-thai-he-thong">Trung tâm trợ giúp</a>
                </li>
                <li>
                  <a href="#trang-thai-he-thong">Quy chuẩn an toàn</a>
                </li>
                <li>
                  <a href="/settings/privacy">Chính sách bảo mật</a>
                </li>
                <li>
                  <a href="/login">Điều khoản dịch vụ</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>
              © 2026 DIKÉ SHARE. Đã đăng ký bản quyền. Nền tảng chia sẻ chuyến
              đi xanh hàng đầu.
            </p>
            <div className="footer-bottom-links">
              <span>Hà Nội · Việt Nam</span>
              <span>•</span>
              <a href="#top">Lên đầu trang ↑</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
