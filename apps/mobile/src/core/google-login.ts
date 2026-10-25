import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { API_BASE_URL } from "./api";

WebBrowser.maybeCompleteAuthSession();

const CALLBACK =
  Platform.OS === "web" && typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "dike://auth/callback";

export async function googleLogin(): Promise<string | null> {
  if (Constants.executionEnvironment === "storeClient") {
    throw new Error(
      "Đăng nhập Google cần bản development build của Dike. Expo Go không hỗ trợ đường dẫn quay lại ứng dụng này.",
    );
  }
  const apiHost = new URL(API_BASE_URL).hostname;
  const usbLocalhost =
    __DEV__ && process.env.EXPO_PUBLIC_ANDROID_USB_LOCALHOST === "true";
  if (["localhost", "127.0.0.1", "[::1]"].includes(apiHost) && !usbLocalhost) {
    throw new Error(
      "Hãy cấu hình EXPO_PUBLIC_API_URL bằng địa chỉ backend điện thoại truy cập được.",
    );
  }
  const verifier =
    Crypto.randomUUID().replaceAll("-", "") +
    Crypto.randomUUID().replaceAll("-", "");
  const state = Crypto.randomUUID().replaceAll("-", "");
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    {
      encoding: Crypto.CryptoEncoding.BASE64,
    },
  );
  const challenge = hash
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
  const authorizationParams = new URLSearchParams({ challenge, state });
  // Native uses the backend's fixed dike:// callback. The optional callback
  // parameter is intentionally reserved for allow-listed browser origins.
  if (Platform.OS === "web") authorizationParams.set("callback", CALLBACK);
  const result = await WebBrowser.openAuthSessionAsync(
    `${API_BASE_URL}/auth/mobile/google?${authorizationParams}`,
    CALLBACK,
  );
  if (result.type !== "success") return null;
  const callback = new URL(result.url);
  if (
    `${callback.protocol}//${callback.host}${callback.pathname}` !== CALLBACK ||
    callback.searchParams.get("state") !== state
  ) {
    throw new Error(
      "Không thể xác minh phiên đăng nhập Google. Vui lòng thử lại.",
    );
  }
  const code = callback.searchParams.get("code");
  if (!code)
    throw new Error("Google chưa hoàn tất đăng nhập. Vui lòng thử lại.");
  const response = await fetch(`${API_BASE_URL}/auth/mobile/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, verifier }),
  });
  if (!response.ok)
    throw new Error(
      "Phiên đăng nhập hết hạn hoặc backend chưa sẵn sàng. Vui lòng thử lại.",
    );
  const body = (await response.json()) as { token?: string };
  if (!body.token)
    throw new Error("Backend không trả về phiên đăng nhập hợp lệ.");
  return body.token;
}
