---
name: floating-glass-header
description: >-
  Universal design system, CSS recipes, and component architecture for creating a luxury floating glassmorphism header (Tri-Island Floating Glass Navbar). Features ultra-transparent frosted glass capsules, specular inner glows, backdrop-blur, scroll-adaptive opacity, responsive mobile collapse, and support for Tailwind CSS, Vanilla CSS, React, and Vue.
---

# Floating Glass Header Skill (Liquid Glass Island Navbar)

This skill provides the complete design formula, optical recipes, and modular code templates to implement a **high-end, ultra-transparent floating glassmorphism header** across any web project.

Inspired by luxury editorial interfaces (such as Apple iOS Dynamic Island, Miroir Atelier, and modern spatial UI design), this navigation pattern uses **detached floating capsule islands** that let vibrant hero backgrounds, 3D canvases, or photography seamlessly shine through with realistic optical refraction.

---

## 1. Visual Anatomy & The 3-Island Layout

Unlike conventional full-width opaque navbars, the **Floating Glass Header** splits navigation into **three floating pill islands**:

```text
+----------------------------------------------------------------------------------------------------+
|  Top Spacing (pt-3 to pt-5, fixed/sticky or absolute z-50)                                        |
|                                                                                                    |
|  [ ISLAND 1: BRAND ]               [ ISLAND 2: NAV TABS ]               [ ISLAND 3: ACTIONS ]      |
|  +-----------------------+         +-------------------------------+    +------------------------+ |
|  | (•) BRANDNAME         |         | Link1   Link2*  Link3   Link4 |    | (🔍)  [• EN]  [ CTA →] | |
|  +-----------------------+         +-------------------------------+    +------------------------+ |
|   Logo badge + tracking             Centered horizontal pill             Search + Lang + Accent CTA |
|                                     Active indicator underline/dot                                  |
+----------------------------------------------------------------------------------------------------+
  ▲ Background scenery, 3D WebGL canvas, video, or hero gradients flow uninterrupted underneath ▲
```

### The 3 Capsules

1. **Brand Capsule (Left)**:
   - Houses the logo mark and brand typography (high tracking, uppercase, bold).
   - Micro-interaction: `hover:scale-[1.02]` with smooth spring ease.
2. **Navigation Capsule (Center)**:
   - Positioned dynamically or centrally anchored (`left-1/2 -translate-x-1/2`).
   - Houses main page links with subtle hover contrast shifts.
   - Active state features a luminous accent dash (`w-5 h-[2.5px] rounded-full bg-[brand-accent]`).
   - Collapses gracefully on mobile screens (< 768px).
3. **Utility & Action Capsule (Right)**:
   - Quick search button (circular translucent touch target).
   - Segmented toggle / language switcher with active status dot.
   - High-contrast Call-To-Action (CTA) pill button with saturated brand color and white typography.

---

## 2. The Optical "Liquid Glass" CSS Formula

Achieving the high-end, realistic glass look in the reference requires **5 optical layers**:

### 1. Base Translucency

```css
background: rgba(255, 255, 255, 0.2); /* Light mode resting */
/* Hover state lifts slightly for tactile feedback: */
/* background: rgba(255, 255, 255, 0.35); */
```

### 2. Physical Refraction & Saturation (Backdrop Filter)

A simple blur is not enough; adding saturation makes colors passing beneath feel vivid rather than dull/milky:

```css
backdrop-filter: blur(12px) saturate(180%);
-webkit-backdrop-filter: blur(12px) saturate(180%);
```

### 3. Crisp Rim Light Border

A hairline border with 40-50% white simulates light catching the bevelled edge of cut glass:

```css
border: 1px solid rgba(255, 255, 255, 0.45);
```

### 4. Specular Highlight (The Secret Sauce)

An inner top shadow mimics the physics of light hitting the top rim of a physical glass lens:

```css
/* Specular highlight: inset 0 1px 1px 0 rgba(255, 255, 255, 0.60) */
```

### 5. Ambient Soft Diffusion Shadow

A wide, low-opacity shadow lifts the island off the page surface:

```css
/* Ambient drop shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.06) */
```

### Combined CSS Box Shadow Token

```css
box-shadow:
  0 8px 32px 0 rgba(0, 0, 0, 0.06),
  inset 0 1px 1px 0 rgba(255, 255, 255, 0.6);
```

---

## 3. Tailwind CSS Master Utility Classes

Use these ready-to-use Tailwind class combinations:

### Glass Capsule Pill (Base)

```html
<div
  class="rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.6)] transition-all duration-300"
>
  <!-- Capsule Content -->
</div>
```

### Dark Glass Capsule Pill (Dark Mode / Cyberpunk)

```html
<div
  class="rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-md border border-white/15 text-white shadow-[0_8px_32px_0_rgba(0,0,0,0.35),inset_0_1px_1px_0_rgba(255,255,255,0.15)] transition-all duration-300"
>
  <!-- Capsule Content -->
</div>
```

### Scrolled / Condensed Sticky Pill (When Scrolled Down)

When user scrolls down past the hero, boost the background opacity to prevent text behind it from causing readability issues:

```html
<div
  class="rounded-full bg-white/75 hover:bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_12px_40px_0_rgba(0,0,0,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.9)] transition-all duration-300"
>
  <!-- Scrolled Capsule Content -->
</div>
```

### Pill CTA Button (Luminous Brand Accent)

```html
<a
  href="/get-started"
  class="inline-flex items-center gap-1.5 rounded-full bg-[#B3D07E] hover:bg-[#A3C46C] backdrop-blur-sm !text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)] px-4 py-1.5 text-xs sm:text-[13px] font-bold tracking-wide border border-white/40 shadow-[0_4px_14px_rgba(179,208,126,0.35)] transition-all hover:scale-[1.03]"
>
  <span>Bắt đầu</span>
  <span class="text-sm leading-none">→</span>
</a>
```

---

## 4. Design Tokens & Color Customization Matrix

Swap the tokens below to adapt the header to any branding:

| Token Role       | Miroir (Fashion-Tech)       | Luxury / Dark Mode          | Modern SaaS / FinTech       |
| :--------------- | :-------------------------- | :-------------------------- | :-------------------------- |
| **Glass Base**   | `rgba(255, 255, 255, 0.20)` | `rgba(18, 18, 20, 0.40)`    | `rgba(240, 245, 255, 0.25)` |
| **Glass Border** | `rgba(255, 255, 255, 0.45)` | `rgba(255, 255, 255, 0.12)` | `rgba(255, 255, 255, 0.50)` |
| **Inner Glow**   | `rgba(255, 255, 255, 0.60)` | `rgba(255, 255, 255, 0.18)` | `rgba(255, 255, 255, 0.70)` |
| **Primary Text** | `#161616` (Deep Ink)        | `#FFFFFF` (Crisp White)     | `#0F172A` (Slate 900)       |
| **Muted Text**   | `#3D4B3B` (Earthy Pine)     | `#A1A1AA` (Zinc 400)        | `#475569` (Slate 600)       |
| **Accent CTA**   | `#B3D07E` (Spring Mint)     | `#E2B857` (Champagne Gold)  | `#3B82F6` (Electric Blue)   |
| **CTA Hover**    | `#A3C46C`                   | `#CCA246`                   | `#2563EB`                   |
| **CTA Glow**     | `rgba(179, 208, 126, 0.35)` | `rgba(226, 184, 87, 0.40)`  | `rgba(59, 130, 246, 0.35)`  |

---

## 5. Responsive Behavior & Viewport Budget

1. **Desktop ($\ge$ 1024px)**:
   - Full 3-island detached display.
   - Height: 64px - 76px.
   - Nav links with full spacing (`gap-8`), Search + Language switch + CTA visible.
2. **Tablet (768px - 1023px)**:
   - Compact center nav (`gap-4` or icon-only for secondary actions).
   - Search icon and CTA preserved.
3. **Mobile (< 768px)**:
   - Center navigation tabs collapse into a floating mobile slideover / bottom sheet.
   - Left brand capsule and right actions capsule remain floating.
   - Right capsule simplifies into: Search or CTA + Mobile Menu Hamburger button (`w-9 h-9 rounded-full bg-white/20`).

---

## 6. Scroll State Listener (Adaptive Frosted Glass)

When building sticky/fixed floating headers, add a scroll threshold hook (`scrollY > 30` or `50px`):

```javascript
import { useState, useEffect } from "react";

export function useHeaderScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > threshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return scrolled;
}
```

Dynamic class switching:

```jsx
const glassClass = scrolled
  ? "bg-white/80 backdrop-blur-xl border-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)]"
  : "bg-white/20 hover:bg-white/35 backdrop-blur-md border-white/45 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.6)]";
```

---

## 7. Cross-Browser & Performance Checklist

1. **Firefox Backdrop-Filter Compatibility**:
   - Always declare both `-webkit-backdrop-filter` and `backdrop-filter`.
   - Provide a fallback solid/semi-translucent background color (`rgba(255,255,255,0.85)`) inside `@supports not (backdrop-filter: blur(10px))`.
2. **GPU Acceleration**:
   - Add `will-change: transform, backdrop-filter;` or `transform: translateZ(0);` on the header wrapper to eliminate jitter during smooth scrolling.
3. **Z-Index Layering**:
   - Ensure header has `z-30` to `z-50`, above hero images, 3D canvases, and modals.
4. **Contrast Accessibility (WCAG 2.1 AA)**:
   - Test text readability against light and dark background patches.
   - If hero images vary wildly in luminance, use `text-[#111111]` on light glass or apply a subtle top gradient vignette (`bg-gradient-to-b from-black/20 to-transparent`) behind the header.

---

## 8. Ready-To-Use Code Templates

The following modular templates are provided inside this skill's `templates/` folder:

- [FloatingGlassHeader.jsx](templates/FloatingGlassHeader.jsx): Full React + Tailwind CSS component with active state, search toggle, bilingual switcher, scroll detection, and mobile drawer.
- [floating-glass-header.css](templates/floating-glass-header.css): Pure Vanilla CSS stylesheet with custom properties (`var(--glass-...)`), compatible with any framework or static HTML.
- [FloatingGlassHeader.vue](templates/FloatingGlassHeader.vue): Full Vue 3 (Composition API / `<script setup>`) single-file component.
