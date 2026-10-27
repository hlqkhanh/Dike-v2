import type { PlaceResponse } from "@dike/api-client-ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionStorage } from "./session-storage";
import { useSession } from "./session";
import { useMobileApi } from "./hooks";

export type SavedPlace = Pick<
  PlaceResponse,
  "displayLabel" | "publicAreaLabel" | "latitude" | "longitude"
>;
type Preferences = {
  configured: boolean;
  pickup?: SavedPlace;
  recent: SavedPlace[];
};
const empty: Preferences = { configured: false, recent: [] };
const writes = new Map<string, Promise<void>>();
const placeKey = (place: SavedPlace) => `${place.latitude}.${place.longitude}`;
const snapshot = (place: SavedPlace): SavedPlace => ({
  displayLabel: place.displayLabel,
  publicAreaLabel: place.publicAreaLabel,
  latitude: place.latitude,
  longitude: place.longitude,
});
export const samePlace = (a: SavedPlace, b: SavedPlace) =>
  Math.abs(a.latitude - b.latitude) < 0.00001 &&
  Math.abs(a.longitude - b.longitude) < 0.00001;

function validPlace(value: unknown): value is SavedPlace {
  if (!value || typeof value !== "object") return false;
  const p = value as SavedPlace;
  return (
    typeof p.displayLabel === "string" &&
    typeof p.publicAreaLabel === "string" &&
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 85 &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180
  );
}

export function usePlaces() {
  const { session } = useSession();
  const client = useQueryClient();
  const userId = session?.user.id;
  const key = ["place-preferences", userId];
  const storageKey = `dike.places.${userId}`;
  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async (): Promise<Preferences> => {
      const raw = await sessionStorage.getItemAsync(storageKey);
      if (!raw) return empty;
      try {
        const data = JSON.parse(raw);
        if (data.version === 2) {
          const readPlace = async (id: unknown) => {
            if (typeof id !== "string" || !/^[0-9.-]+$/.test(id))
              return undefined;
            const stored = await sessionStorage.getItemAsync(
              `${storageKey}.place.${id}`,
            );
            if (!stored) return undefined;
            try {
              const value = JSON.parse(stored);
              return validPlace(value) ? value : undefined;
            } catch {
              return undefined;
            }
          };
          const [pickup, recent] = await Promise.all([
            readPlace(data.pickup),
            Promise.all(
              (Array.isArray(data.recent) ? data.recent.slice(0, 8) : []).map(
                readPlace,
              ),
            ),
          ]);
          return {
            configured: data.configured === true,
            pickup,
            recent: recent.filter((p): p is SavedPlace => !!p),
          };
        }
        return {
          configured: data.configured === true,
          pickup: validPlace(data.pickup) ? data.pickup : undefined,
          recent: Array.isArray(data.recent)
            ? data.recent.filter(validPlace).slice(0, 8)
            : [],
        };
      } catch {
        return empty;
      }
    },
  });
  const update = (transform: (previous: Preferences) => Preferences) => {
    if (!userId) throw new Error("Đăng nhập để lưu địa chỉ.");
    const operation = (writes.get(storageKey) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const next = transform(client.getQueryData<Preferences>(key) ?? empty);
        // Store each address separately so a history list does not exceed SecureStore's item size.
        const saved = [...next.recent, ...(next.pickup ? [next.pickup] : [])];
        for (const place of saved)
          await sessionStorage.setItemAsync(
            `${storageKey}.place.${placeKey(place)}`,
            JSON.stringify(snapshot(place)),
          );
        await sessionStorage.setItemAsync(
          storageKey,
          JSON.stringify({
            version: 2,
            configured: next.configured,
            pickup: next.pickup ? placeKey(next.pickup) : undefined,
            recent: next.recent.map(placeKey),
          }),
        );
        const previous = client.getQueryData<Preferences>(key);
        client.setQueryData(key, next);
        const kept = new Set(saved.map(placeKey));
        for (const old of [
          ...(previous?.recent ?? []),
          ...(previous?.pickup ? [previous.pickup] : []),
        ])
          if (!kept.has(placeKey(old)))
            await sessionStorage.deleteItemAsync(
              `${storageKey}.place.${placeKey(old)}`,
            );
      });
    writes.set(storageKey, operation);
    void operation
      .finally(() => {
        if (writes.get(storageKey) === operation) writes.delete(storageKey);
      })
      .catch(() => undefined);
    return operation;
  };
  return {
    ...query,
    preferences: query.data ?? empty,
    remember: (place: SavedPlace, pickup = false) =>
      update((previous) => ({
        ...previous,
        configured: pickup || previous.configured,
        pickup: pickup ? place : previous.pickup,
        recent: [
          place,
          ...previous.recent.filter((p) => !samePlace(p, place)),
        ].slice(0, 8),
      })),
    remove: (place: SavedPlace) =>
      update((previous) => ({
        ...previous,
        recent: previous.recent.filter((p) => !samePlace(p, place)),
      })),
    skip: () => update((previous) => ({ ...previous, configured: true })),
  };
}

export function useResolvePlace() {
  const api = useMobileApi();
  return (point: Pick<SavedPlace, "latitude" | "longitude">) =>
    api.call<PlaceResponse>("/routing/places/reverse", "POST", {
      latitude: point.latitude,
      longitude: point.longitude,
    });
}

export async function currentCoordinates(): Promise<{
  latitude: number;
  longitude: number;
}> {
  const Location = await import("expo-location");

  // 1. Kiểm tra quyền hiện tại trước, tránh yêu cầu lại khi đã cấp quyền
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (!permission.granted) {
    throw new Error(
      permission.canAskAgain
        ? "Chưa được cấp quyền vị trí. Vui lòng cho phép ứng dụng truy cập vị trí."
        : "Quyền vị trí đã bị từ chối. Mở Cài đặt để cho phép ứng dụng truy cập vị trí.",
    );
  }

  // 2. Lấy vị trí đã biết gần nhất ngay lập tức (dưới 50ms) để làm fallback
  let fallbackCoords: { latitude: number; longitude: number } | undefined;
  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (
      lastKnown?.coords &&
      Number.isFinite(lastKnown.coords.latitude) &&
      Number.isFinite(lastKnown.coords.longitude) &&
      Math.abs(lastKnown.coords.latitude) <= 85 &&
      Math.abs(lastKnown.coords.longitude) <= 180
    ) {
      fallbackCoords = {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }
  } catch {
    // Bỏ qua lỗi lastKnown, tiếp tục lấy vị trí mới
  }

  // 3. Thử lấy vị trí mới nhất (Accuracy.Balanced) kèm hộp thoại bật định vị trên Android
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), 5000);
      }),
    ]).finally(() => {
      clearTimeout(timer);
    });

    if (fresh?.coords) {
      return {
        latitude: fresh.coords.latitude,
        longitude: fresh.coords.longitude,
      };
    }
  } catch {
    // Nếu Balanced thất bại hoặc timeout: nếu có fallback thì dùng ngay!
    if (fallbackCoords) {
      return fallbackCoords;
    }

    // Nếu chưa có fallback, thử High accuracy với timeout 4s
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const high = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), 4000);
        }),
      ]).finally(() => {
        clearTimeout(timer);
      });

      if (high?.coords) {
        return {
          latitude: high.coords.latitude,
          longitude: high.coords.longitude,
        };
      }
    } catch {
      // Bỏ qua
    }

    // Thử Lowest accuracy (chỉ cần Cell/Wifi, hoạt động tốt trong nhà)
    try {
      const lowest = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
        mayShowUserSettingsDialog: true,
      });
      if (lowest?.coords) {
        return {
          latitude: lowest.coords.latitude,
          longitude: lowest.coords.longitude,
        };
      }
    } catch {
      // Bỏ qua
    }

    // Thử kiểm tra lại lastKnown một lần nữa
    try {
      const retryLast = await Location.getLastKnownPositionAsync();
      if (retryLast?.coords) {
        return {
          latitude: retryLast.coords.latitude,
          longitude: retryLast.coords.longitude,
        };
      }
    } catch {
      // Bỏ qua
    }

    // Kiểm tra xem dịch vụ vị trí có bị tắt trên máy không
    try {
      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        throw new Error(
          "Định vị (GPS) trên thiết bị đang tắt. Vui lòng bật Vị trí trong thanh cài đặt nhanh của điện thoại.",
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("Định vị")) {
        throw e;
      }
    }

    throw new Error(
      "Chưa thể xác định vị trí hiện tại. Vui lòng bật định vị GPS hoặc chọn địa chỉ thủ công.",
    );
  }

  if (fallbackCoords) {
    return fallbackCoords;
  }

  throw new Error(
    "Chưa thể xác định vị trí hiện tại. Vui lòng bật định vị GPS hoặc chọn địa chỉ thủ công.",
  );
}
