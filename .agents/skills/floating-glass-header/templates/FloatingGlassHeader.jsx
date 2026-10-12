import React, { useState, useEffect } from "react";

/**
 * FloatingGlassHeader
 * 
 * Reusable luxury floating glassmorphism header featuring a 3-island layout:
 * - Left Island: Logo badge and brand wordmark.
 * - Center Island: Navigation links with active indicator and hover styling.
 * - Right Island: Quick Search, Language Switcher, and Accent CTA Button.
 * 
 * Props:
 * - brandName: string (e.g. "MIROIR")
 * - logoSrc: string (e.g. "/logo-web.png")
 * - navLinks: Array<{ label: string, href: string, active?: boolean }>
 * - ctaText: string (e.g. "Bắt đầu →")
 * - ctaHref: string (e.g. "/login")
 * - onSearchClick?: () => void
 * - language?: "vi" | "en"
 * - onToggleLanguage?: () => void
 * - accentColor?: string (hex, default "#B3D07E")
 */
export default function FloatingGlassHeader({
  brandName = "MIROIR",
  logoSrc = "/logo-web.png",
  navLinks = [
    { label: "Trang chủ", href: "/", active: true },
    { label: "Sản phẩm", href: "/products" },
    { label: "Thử đồ", href: "/try-on" },
    { label: "Stylist AI", href: "/stylist" },
  ],
  ctaText = "Bắt đầu →",
  ctaHref = "/login",
  onSearchClick,
  language = "VI",
  onToggleLanguage,
  accentColor = "#B3D07E",
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll detection to adapt background opacity when leaving the hero section
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Shared glass surface styling tokens
  const glassBaseClasses = isScrolled
    ? "bg-white/75 hover:bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_12px_40px_0_rgba(0,0,0,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.9)]"
    : "bg-white/20 hover:bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.6)]";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-[76px] w-full items-center justify-between px-4 sm:px-8 lg:px-16 pt-3 pb-2 transition-all duration-300 pointer-events-none">
      
      {/* ============================================================ */}
      {/* 1. BRAND CAPSULE (LEFT)                                      */}
      {/* ============================================================ */}
      <a
        href="/"
        className={`pointer-events-auto flex items-center gap-2.5 rounded-full px-3.5 py-1.5 transition-all duration-300 group hover:scale-[1.02] ${glassBaseClasses}`}
      >
        {logoSrc && (
          <img
            src={logoSrc}
            alt={brandName}
            className="h-7 w-7 rounded-full border border-white/50 bg-white/40 object-cover shadow-xs transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span className="font-display text-base sm:text-[17px] font-black uppercase tracking-[0.24em] text-[#161616] pr-1.5">
          {brandName}
        </span>
      </a>

      {/* ============================================================ */}
      {/* 2. NAVIGATION TABS CAPSULE (CENTER)                          */}
      {/* ============================================================ */}
      <nav
        className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-6 lg:gap-8 rounded-full px-6 py-2 transition-all duration-300 ${glassBaseClasses}`}
      >
        {navLinks.map((item) => (
          <a
            key={item.href + item.label}
            href={item.href}
            className={`relative py-0.5 text-[13px] lg:text-[13.5px] tracking-wide transition-colors ${
              item.active
                ? "font-bold text-[#111111]"
                : "font-medium text-[#3D4B3B] hover:text-[#111111]"
            }`}
          >
            {item.label}
            {item.active && (
              <span
                style={{ backgroundColor: accentColor }}
                className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-5 h-[2.5px] rounded-full shadow-[0_0_8px_rgba(179,208,126,0.8)]"
              />
            )}
          </a>
        ))}
      </nav>

      {/* ============================================================ */}
      {/* 3. UTILITY & ACTIONS CAPSULE (RIGHT)                         */}
      {/* ============================================================ */}
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full p-1.5 pl-2.5 transition-all duration-300 ${glassBaseClasses}`}
      >
        {/* Quick Search */}
        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/30 text-[#2D3A2B] hover:text-[#111111] transition-colors"
            title="Search"
            aria-label="Search"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-1.35z" />
            </svg>
          </button>
        )}

        {/* Language Switcher */}
        {onToggleLanguage && (
          <button
            type="button"
            onClick={onToggleLanguage}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 hover:bg-white/50 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2C382A] shadow-xs transition-colors"
          >
            <span
              style={{ backgroundColor: accentColor }}
              className="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(179,208,126,0.8)]"
            />
            {language}
          </button>
        )}

        {/* Mobile Hamburger Toggle (Visible on < md) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex md:hidden items-center justify-center w-8 h-8 rounded-full hover:bg-white/30 text-[#2D3A2B] transition-colors"
          aria-label="Toggle mobile menu"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Call to Action Button */}
        {ctaText && (
          <a
            href={ctaHref}
            style={{ backgroundColor: accentColor, color: "#FFFFFF" }}
            className="inline-flex items-center gap-1.5 rounded-full hover:brightness-95 backdrop-blur-sm !text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)] px-4 py-1.5 text-xs sm:text-[12.5px] font-bold tracking-wide border border-white/40 shadow-[0_4px_14px_rgba(179,208,126,0.35)] transition-all hover:scale-[1.03]"
          >
            <span className="!text-white">{ctaText}</span>
          </a>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. MOBILE SLIDEOUT DRAWER (WHEN MENU IS OPEN)                */}
      {/* ============================================================ */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto fixed inset-x-4 top-20 z-50 flex flex-col gap-2 rounded-3xl bg-white/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-2xl border border-white/80 md:hidden animate-in fade-in slide-in-from-top-3 duration-200">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#7D8F7B] px-2 mb-1">
            Menu
          </p>
          {navLinks.map((item) => (
            <a
              key={item.href + item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                item.active
                  ? "bg-[#F3F6EC] text-[#111111]"
                  : "text-[#2D3A2B] hover:bg-[#FAFBF7]"
              }`}
            >
              <span>{item.label}</span>
              {item.active && (
                <span
                  style={{ backgroundColor: accentColor }}
                  className="h-2 w-2 rounded-full"
                />
              )}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
