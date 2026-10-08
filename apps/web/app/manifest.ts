import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DIKÉ SHARE",
    short_name: "Dike",
    description: "Đi chung xe an toàn cùng cộng đồng.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3fbf7",
    theme_color: "#078f68",
    lang: "vi",
    icons: [
      {
        src: "/images/dike_logo_clean.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
