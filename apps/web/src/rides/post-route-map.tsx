"use client";

import { useEffect, useRef, useState } from "react";
import { Map, Marker, Popup, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RidePostRoute } from "@dike/api-client-ts";
import { journeyRouteSegments } from "./post-route-data";

type MapMember = { name: string; avatarUrl?: string | null };
function memberMarker(
  member: MapMember,
  letter: "A" | "B" | "C" | "D",
  sharedMember?: MapMember,
) {
  const element = document.createElement("div");
  const kind = letter === "A" || letter === "B" ? "origin" : "destination";
  element.className = `route-member-marker route-member-marker--${letter.toLowerCase()} route-member-marker--${kind}`;
  element.setAttribute(
    "aria-label",
    `${kind === "origin" ? "Điểm đón" : "Điểm đến"} của ${member.name}${sharedMember ? " và " + sharedMember.name : ""}`,
  );
  const pin = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  pin.setAttribute("viewBox", "0 0 48 60");
  pin.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute(
    "d",
    "M24 2C11.85 2 2 11.85 2 24C2 40 24 58 24 58S46 40 46 24C46 11.85 36.15 2 24 2Z",
  );
  pin.append(shape);
  const avatar = document.createElement("span");
  avatar.className = "route-member-marker-avatar";
  const initials = member.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi-VN");
  avatar.textContent = initials || "DK";
  if (member.avatarUrl && /^(https?:\/\/|\/)/.test(member.avatarUrl)) {
    const img = document.createElement("img");
    img.src = member.avatarUrl;
    img.alt = member.name;
    img.addEventListener(
      "error",
      () => {
        avatar.textContent = initials || "DK";
      },
      { once: true },
    );
    avatar.replaceChildren(img);
  }
  element.append(pin, avatar);
  if (sharedMember) {
    element.classList.add("route-member-marker--shared");
    const sharedAvatar = memberMarker(sharedMember, letter).querySelector(
      ".route-member-marker-avatar",
    )!;
    sharedAvatar.classList.add("route-member-marker-avatar--shared");
    element.append(sharedAvatar);
  }
  return element;
}

setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

export default function PostRouteMap({
  route,
  origin,
  destination,
  pickup,
  pickupIndex,
  driver,
  passenger,
  layer = "map",
  padding,
  routeColor = "#07966e",
  dropoff,
  dropoffIndex,
}: {
  route?: RidePostRoute;
  origin: string;
  destination: string;
  pickup?: { longitude: number; latitude: number; displayLabel: string };
  pickupIndex?: number;
  driver?: MapMember;
  passenger?: MapMember;
  layer?: "map" | "satellite";
  padding?: number;
  routeColor?: string;
  dropoff?: { longitude: number; latitude: number; displayLabel: string };
  dropoffIndex?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    const coordinates = (route?.geometry ?? []).map(
      (p) => [p.longitude, p.latitude] as [number, number],
    );
    const visiblePoints = [...coordinates];
    if (pickup) visiblePoints.push([pickup.longitude, pickup.latitude]);
    if (dropoff) visiblePoints.push([dropoff.longitude, dropoff.latitude]);
    const bounds =
      visiblePoints.length >= 2
        ? visiblePoints.reduce(
            (b, p) => b.extend(p),
            new LngLatBounds(coordinates[0], coordinates[0]),
          )
        : undefined;
    let map: Map;
    const fitPadding =
      padding ??
      (driver
        ? {
            top: Math.min(140, container.current.clientHeight * 0.4),
            bottom: Math.min(130, container.current.clientHeight * 0.15),
            left: Math.min(60, container.current.clientWidth * 0.12),
            right: Math.min(60, container.current.clientWidth * 0.12),
          }
        : 48);
    try {
      map = new Map({
        container: container.current,
        style:
          layer === "satellite"
            ? {
                version: 8,
                sources: {
                  satellite: {
                    type: "raster",
                    tiles: [
                      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    ],
                    tileSize: 256,
                    attribution: "Tiles &copy; Esri",
                  },
                },
                layers: [
                  { id: "satellite", type: "raster", source: "satellite" },
                ],
              }
            : "https://tiles.openfreemap.org/styles/positron",
        ...(bounds
          ? { bounds }
          : { center: [106.660172, 10.762622] as [number, number], zoom: 12 }),
        fitBoundsOptions: { padding: fitPadding, maxZoom: 15 },
        scrollZoom: true,
        cooperativeGestures: window.matchMedia("(pointer: coarse)").matches,
        attributionControl: {
          compact: true,
          customAttribution:
            '<a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>',
        },
      });
    } catch {
      const timer = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(timer);
    }
    // MapLibre 6 expands compact attribution initially; keep the toggle visible but closed.
    const attribution = container.current.querySelector<HTMLDetailsElement>(
      ".maplibregl-ctrl-attrib",
    );
    attribution?.classList.remove("maplibregl-compact-show");
    attribution?.removeAttribute("open");
    map.on("error", () => setFailed(true));
    map.on("load", () => {
      setFailed(false);
      if (coordinates.length < 2) return;
      const segments = journeyRouteSegments(
        coordinates,
        pickup ? pickupIndex : undefined,
        dropoffIndex,
        routeColor,
      );
      map.addSource("post-route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: segments
            .filter((segment) => segment.coordinates.length >= 2)
            .map((segment) => ({
              type: "Feature",
              properties: { color: segment.color },
              geometry: {
                type: "LineString",
                coordinates: segment.coordinates,
              },
            })),
        },
      });
      map.addLayer({
        id: "route-outline",
        type: "line",
        source: "post-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "post-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 5 },
      });
      type Stop = {
        point: [number, number];
        label: string;
        letter: "A" | "B" | "C" | "D";
        member?: MapMember;
        sharedMember?: MapMember;
      };
      const stops: Stop[] = [
        { point: coordinates[0], label: origin, letter: "A", member: driver },
        {
          point: coordinates[coordinates.length - 1],
          label: destination,
          letter: "C",
          member: driver,
        },
      ];
      if (pickup)
        stops.push({
          point: [pickup.longitude, pickup.latitude],
          label: pickup.displayLabel,
          letter: "B",
          member: passenger,
        });
      if (dropoff || pickup)
        stops.push({
          point: dropoff
            ? [dropoff.longitude, dropoff.latitude]
            : coordinates[coordinates.length - 1],
          label: dropoff?.displayLabel ?? destination,
          letter: "D",
          member: passenger,
        });
      const isOrigin = (stop: Stop) =>
        stop.letter === "A" || stop.letter === "B";
      const samePoint = (a: Stop, b: Stop) => {
        const radians = Math.PI / 180;
        const lat = (a.point[1] - b.point[1]) * radians;
        const lng = (a.point[0] - b.point[0]) * radians;
        const h =
          Math.sin(lat / 2) ** 2 +
          Math.cos(a.point[1] * radians) *
            Math.cos(b.point[1] * radians) *
            Math.sin(lng / 2) ** 2;
        return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))) <= 15;
      };
      const markers: Stop[] = [];
      for (const stop of stops) {
        const shared = markers.find(
          (existing) =>
            isOrigin(existing) === isOrigin(stop) && samePoint(existing, stop),
        );
        if (shared) {
          shared.sharedMember = stop.member;
          shared.label += " · " + stop.label;
        } else markers.push({ ...stop });
      }
      for (const stop of markers) {
        const label = isOrigin(stop) ? "Điểm đón" : "Điểm đến";
        new Marker(
          stop.member
            ? {
                element: memberMarker(
                  stop.member,
                  stop.letter,
                  stop.sharedMember,
                ),
                anchor: "bottom",
              }
            : { color: isOrigin(stop) ? "#e9bd52" : "#07966e" },
        )
          .setLngLat(stop.point)
          .setPopup(
            new Popup({ offset: 28 }).setText(`${label}: ${stop.label}`),
          )
          .addTo(map);
      }
    });
    const resize = new ResizeObserver(() => {
      map.resize();
      if (bounds && container.current && container.current.clientWidth > 0) {
        map.fitBounds(bounds, {
          padding: fitPadding,
          maxZoom: 15,
          duration: 0,
        });
      }
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      map.remove();
    };
  }, [
    route,
    origin,
    destination,
    pickup,
    pickupIndex,
    driver,
    passenger,
    layer,
    padding,
    routeColor,
    dropoff,
    dropoffIndex,
    attempt,
  ]);
  return (
    <div className="post-route-map-frame">
      <div
        ref={container}
        className="post-route-map-canvas"
        role="region"
        aria-label={`Bản đồ tuyến đường từ ${origin} đến ${destination}`}
      />
      {failed && (
        <div className="post-route-map-error" role="status">
          <span>Chưa tải được bản đồ nền.</span>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      )}
    </div>
  );
}
