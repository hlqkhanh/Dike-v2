import type { ImageSourcePropType } from "react-native";
import { API_BASE_URL } from "./api";
import rider1 from "../../assets/avatars/rider-1.jpg";
import rider2 from "../../assets/avatars/rider-2.jpg";
import rider3 from "../../assets/avatars/rider-3.jpg";
import rider4 from "../../assets/avatars/rider-4.jpg";

// Seeded members use web-public paths. Bundle the same photos for native/offline use.
const seededAvatars: Record<string, ImageSourcePropType> = {
  "/images/avatars/rider-1.jpg": rider1,
  "/images/avatars/rider-2.jpg": rider2,
  "/images/avatars/rider-3.jpg": rider3,
  "/images/avatars/rider-4.jpg": rider4,
};

export function avatarSource(
  uri?: string | null,
): ImageSourcePropType | undefined {
  const value = uri?.trim();
  if (!value) return undefined;
  if (seededAvatars[value]) return seededAvatars[value];
  try {
    const base = value.startsWith("/images/")
      ? process.env.EXPO_PUBLIC_WEB_URL || API_BASE_URL
      : API_BASE_URL;
    const url = new URL(value, `${base}/`);
    if (!["http:", "https:"].includes(url.protocol)) return undefined;
    return { uri: url.href };
  } catch {
    return undefined;
  }
}
