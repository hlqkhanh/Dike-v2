import {
  ArrowUpRight,
  CalendarDays,
  Handshake,
  TicketCheck,
} from "lucide-react";
import Link from "next/link";

const sections = [
  {
    href: "/schedules",
    title: "Lịch trình",
    lines: ["Sắp xếp lịch đi, lượt về và", "những hành trình sắp tới."],
    image: "card_1.png",
    Icon: CalendarDays,
  },
  {
    href: "/proposals",
    title: "Đề nghị",
    lines: ["Theo dõi và trao đổi", "các đề nghị đi cùng của bạn."],
    image: "card_2.png",
    Icon: Handshake,
  },
  {
    href: "/bookings",
    title: "Booking",
    lines: ["Quản lý những chuyến đi", "đã ghép và đặt chỗ của bạn."],
    image: "card_3.png",
    Icon: TicketCheck,
  },
];

export default function JourneysPage() {
  return (
    <main className="journeys-hub">
      <header>
        <p>HÀNH TRÌNH CỦA BẠN</p>
        <h1>Chuyến đi</h1>
        <span>
          Mọi thứ cho hành trình tiếp theo,
          <br />ở cùng một nơi.
        </span>
      </header>
      <div className="journeys-hub-grid">
        {sections.map(({ href, title, lines, image, Icon }, index) => (
          <Link
            href={href}
            key={href}
            className={`journeys-hub-card journeys-hub-card--${index} journeys-hub-card--image`}
            style={{
              backgroundImage: `url("/images/${encodeURIComponent(image)}")`,
            }}
          >
            <div className="journeys-hub-card-top">
              <span className="journeys-hub-icon">
                <Icon size={30} strokeWidth={2.3} aria-hidden="true" />
              </span>
              <span className="journeys-hub-image-arrow">
                <ArrowUpRight size={22} aria-hidden="true" />
              </span>
            </div>
            <h2>{title}</h2>
            <p>
              {lines[0]}
              <br />
              {lines[1]}
            </p>
            <span className="journeys-hub-action">
              Mở {title.toLowerCase()}{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
