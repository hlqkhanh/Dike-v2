import { Image, Platform } from "react-native";
import { avatarSource } from "./avatar-source";
import type { RouteMapMember } from "./route-map-html";

export function mapMember(
  id: string,
  name: string,
  avatar?: string | null,
): RouteMapMember {
  const source = avatarSource(avatar);
  let avatarUrl: string | undefined;
  if (source) {
    if (Platform.OS !== "web")
      avatarUrl = Image.resolveAssetSource(source)?.uri;
    else if (
      typeof source === "object" &&
      !Array.isArray(source) &&
      "uri" in source
    )
      avatarUrl = source.uri;
  }
  return { id, name, avatarUrl };
}
