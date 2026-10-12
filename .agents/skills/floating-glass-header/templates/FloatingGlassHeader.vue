<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  brandName: { type: String, default: 'MIROIR' },
  logoSrc: { type: String, default: '/logo-web.png' },
  navLinks: {
    type: Array,
    default: () => [
      { label: 'Trang chủ', href: '/', active: true },
      { label: 'Sản phẩm', href: '/products', active: false },
      { label: 'Thử đồ', href: '/try-on', active: false },
      { label: 'Stylist AI', href: '/stylist', active: false }
    ]
  },
  ctaText: { type: String, default: 'Bắt đầu →' },
  ctaHref: { type: String, default: '/login' },
  language: { type: String, default: 'VI' },
  accentColor: { type: String, default: '#B3D07E' }
});

const emit = defineEmits(['search', 'toggle-language']);

const isScrolled = ref(false);
const isMobileMenuOpen = ref(false);

const handleScroll = () => {
  isScrolled.value = window.scrollY > 40;
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 flex h-[76px] w-full items-center justify-between px-4 sm:px-8 lg:px-16 pt-3 pb-2 transition-all duration-300 pointer-events-none"
  >
    <!-- 1. BRAND ISLAND -->
    <a
      href="/"
      :class="[
        'pointer-events-auto flex items-center gap-2.5 rounded-full px-3.5 py-1.5 transition-all duration-300 group hover:scale-[1.02]',
        isScrolled
          ? 'bg-white/75 hover:bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_12px_40px_0_rgba(0,0,0,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.9)]'
          : 'bg-white/20 hover:bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.6)]'
      ]"
    >
      <img
        v-if="logoSrc"
        :src="logoSrc"
        :alt="brandName"
        class="h-7 w-7 rounded-full border border-white/50 bg-white/40 object-cover shadow-xs transition-transform duration-300 group-hover:scale-105"
      />
      <span class="font-display text-base sm:text-[17px] font-black uppercase tracking-[0.24em] text-[#161616] pr-1.5">
        {{ brandName }}
      </span>
    </a>

    <!-- 2. NAV TABS ISLAND -->
    <nav
      :class="[
        'pointer-events-auto absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-6 lg:gap-8 rounded-full px-6 py-2 transition-all duration-300',
        isScrolled
          ? 'bg-white/75 hover:bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_12px_40px_0_rgba(0,0,0,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.9)]'
          : 'bg-white/20 hover:bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.6)]'
      ]"
    >
      <a
        v-for="item in navLinks"
        :key="item.href"
        :href="item.href"
        :class="[
          'relative py-0.5 text-[13px] lg:text-[13.5px] tracking-wide transition-colors',
          item.active
            ? 'font-bold text-[#111111]'
            : 'font-medium text-[#3D4B3B] hover:text-[#111111]'
        ]"
      >
        {{ item.label }}
        <span
          v-if="item.active"
          :style="{ backgroundColor: accentColor }"
          class="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-5 h-[2.5px] rounded-full shadow-[0_0_8px_rgba(179,208,126,0.8)]"
        />
      </a>
    </nav>

    <!-- 3. ACTIONS ISLAND -->
    <div
      :class="[
        'pointer-events-auto flex items-center gap-2 rounded-full p-1.5 pl-2.5 transition-all duration-300',
        isScrolled
          ? 'bg-white/75 hover:bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_12px_40px_0_rgba(0,0,0,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.9)]'
          : 'bg-white/20 hover:bg-white/35 backdrop-blur-md border border-white/45 shadow-[0_8px_32px_0_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.6)]'
      ]"
    >
      <!-- Search Button -->
      <button
        type="button"
        @click="emit('search')"
        class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/30 text-[#2D3A2B] hover:text-[#111111] transition-colors"
        title="Search"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-1.35z" />
        </svg>
      </button>

      <!-- Language Toggle -->
      <button
        type="button"
        @click="emit('toggle-language')"
        class="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/30 hover:bg-white/50 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2C382A] shadow-xs transition-colors"
      >
        <span
          :style="{ backgroundColor: accentColor }"
          class="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(179,208,126,0.8)]"
        />
        {{ language }}
      </button>

      <!-- Mobile Hamburger -->
      <button
        type="button"
        @click="isMobileMenuOpen = !isMobileMenuOpen"
        class="flex md:hidden items-center justify-center w-8 h-8 rounded-full hover:bg-white/30 text-[#2D3A2B] transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path v-if="isMobileMenuOpen" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          <path v-else strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- CTA Button -->
      <a
        v-if="ctaText"
        :href="ctaHref"
        :style="{ backgroundColor: accentColor, color: '#FFFFFF' }"
        class="inline-flex items-center gap-1.5 rounded-full hover:brightness-95 backdrop-blur-sm !text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)] px-4 py-1.5 text-xs sm:text-[12.5px] font-bold tracking-wide border border-white/40 shadow-[0_4px_14px_rgba(179,208,126,0.35)] transition-all hover:scale-[1.03]"
      >
        <span class="!text-white">{{ ctaText }}</span>
      </a>
    </div>

    <!-- 4. MOBILE DRAWER -->
    <div
      v-if="isMobileMenuOpen"
      class="pointer-events-auto fixed inset-x-4 top-20 z-50 flex flex-col gap-2 rounded-3xl bg-white/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-2xl border border-white/80 md:hidden"
    >
      <a
        v-for="item in navLinks"
        :key="item.href"
        :href="item.href"
        @click="isMobileMenuOpen = false"
        :class="[
          'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
          item.active ? 'bg-[#F3F6EC] text-[#111111]' : 'text-[#2D3A2B] hover:bg-[#FAFBF7]'
        ]"
      >
        <span>{{ item.label }}</span>
        <span
          v-if="item.active"
          :style="{ backgroundColor: accentColor }"
          class="h-2 w-2 rounded-full"
        />
      </a>
    </div>
  </header>
</template>
