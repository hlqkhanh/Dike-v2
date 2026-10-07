import {
  ApiError,
  createApiClientConfiguration,
  type ApiClientConfiguration,
} from "@dike/api-client-ts";

export type PlaceSessionResponse = {
  sessionToken: string;
  expiresAt: string;
};

export type PlaceSuggestionResponse = {
  placeRef: string;
  mainText: string;
  secondaryText: string;
  displayLabel: string;
};

export type PlaceResponse = {
  placeRef: string;
  displayLabel: string;
  publicAreaLabel: string;
  longitude: number;
  latitude: number;
  resolvedAt: string;
};

export type VehicleMode = "MOTORBIKE" | "CAR";

export type RoutePoint = {
  longitude: number;
  latitude: number;
};

export type RoutePlace = {
  displayLabel: string;
  publicAreaLabel: string;
  longitude: number;
  latitude: number;
};

export type RouteResponse = {
  id: string;
  provider: string;
  vehicleMode: VehicleMode;
  origin: RoutePlace;
  destination: RoutePlace;
  distanceMeters: number;
  durationSeconds: number;
  geometry: RoutePoint[];
  calculatedAt: string;
  expiresAt: string;
};

export type ContributionEstimate = {
  estimateId: string;
  routeSnapshotId: string;
  sharedDistanceMeters: number;
  suggestedPerKmVnd: number;
  amountVnd: number;
  demo: boolean;
  calculatedAt: string;
  expiresAt: string;
};

export function createRoutingApi(configuration: ApiClientConfiguration) {
  const config = createApiClientConfiguration(configuration);

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const requestId = config.requestId?.();
    if (requestId) headers.set("X-Request-Id", requestId);
    if (init.body) headers.set("Content-Type", "application/json");
    if (init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method)) {
      const csrf = readCookie("XSRF-TOKEN");
      if (csrf) headers.set("X-XSRF-TOKEN", decodeURIComponent(csrf));
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: config.credentials,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { error?: { code?: string; message?: string } }
        | undefined;
      throw new ApiError(
        response.status,
        body?.error?.code ?? "ROUTING_REQUEST_FAILED",
        body?.error?.message ?? "Không thể xử lý yêu cầu bản đồ",
      );
    }
    return (await response.json()) as T;
  }

  return {
    createPlaceSession: () =>
      request<PlaceSessionResponse>("/routing/place-sessions", {
        method: "POST",
      }),
    autocompletePlaces: (
      sessionToken: string,
      query: string,
      bias?: { latitude: number; longitude: number },
    ) => {
      const params = new URLSearchParams({
        sessionToken,
        query,
      });
      if (bias) {
        params.set("biasLatitude", String(bias.latitude));
        params.set("biasLongitude", String(bias.longitude));
      }
      return request<PlaceSuggestionResponse[]>(
        `/routing/places?${params.toString()}`,
      );
    },
    resolvePlace: (sessionToken: string, placeRef: string) =>
      request<PlaceResponse>("/routing/places/resolve", {
        method: "POST",
        body: JSON.stringify({ sessionToken, placeRef }),
      }),
    createRoute: (
      originPlaceRef: string,
      destinationPlaceRef: string,
      vehicleMode: VehicleMode,
    ) =>
      request<RouteResponse>("/routing/routes", {
        method: "POST",
        body: JSON.stringify({
          originPlaceRef,
          destinationPlaceRef,
          vehicleMode,
        }),
      }),
    createEstimate: (
      routeSnapshotId: string,
      sharedDistanceMeters: number,
      passengerSeats: number,
    ) =>
      request<ContributionEstimate>("/routing/estimates", {
        method: "POST",
        body: JSON.stringify({
          routeSnapshotId,
          sharedDistanceMeters,
          passengerSeats,
        }),
      }),
  };
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
