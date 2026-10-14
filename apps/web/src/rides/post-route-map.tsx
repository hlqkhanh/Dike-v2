"use client";

import { useEffect, useRef, useState } from "react";
import { Map, Marker, Popup, LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RidePostRoute } from "@dike/api-client-ts";

type MapMember = { name: string; avatarUrl?: string | null };
function memberMarker(member: MapMember, letter: "A" | "B") {
  const element = document.createElement("div");
  element.className = `route-member-marker route-member-marker--${letter.toLowerCase()}`;
  element.setAttribute("aria-label", `Điểm xuất phát của ${member.name}`);
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
}: {
  route: RidePostRoute;
  origin: string;
  destination: string;
  pickup?: { longitude: number; latitude: number; displayLabel: string };
  pickupIndex?: number;
  driver?: MapMember;
  passenger?: MapMember;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!container.current || route.geometry.length < 2) return;
    const coordinates = route.geometry.map(
      (p) => [p.longitude, p.latitude] as [number, number],
    );
    const bounds = coordinates.reduce(
      (b, p) => b.extend(p),
      new LngLatBounds(coordinates[0], coordinates[0]),
    );
    let map: Map;
    const fitPadding = driver
      ? { top: 140, bottom: 130, left: 60, right: 60 }
      : 48;
    try {
      map = new Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        bounds,
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
      const split =
        pickup &&
        typeof pickupIndex === "number" &&
        pickupIndex >= 0 &&
        pickupIndex < coordinates.length;
      const segments = split
        ? [
            {
              coordinates: coordinates.slice(0, pickupIndex + 1),
              color: "#e6aa32",
            },
            { coordinates: coordinates.slice(pickupIndex), color: "#07966e" },
          ]
        : [{ coordinates, color: "#07966e" }];
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
      new Marker(
        driver
          ? { element: memberMarker(driver, "A"), anchor: "bottom" }
          : { color: "#07966e" },
      )
        .setLngLat(coordinates[0])
        .setPopup(new Popup({ offset: 28 }).setText(origin))
        .addTo(map);
      new Marker({ color: driver ? "#07966e" : "#ef4444" })
        .setLngLat(coordinates[coordinates.length - 1])
        .setPopup(new Popup({ offset: 28 }).setText(destination))
        .addTo(map);
      if (pickup)
        new Marker(
          passenger
            ? { element: memberMarker(passenger, "B"), anchor: "bottom" }
            : { color: "#2563eb" },
        )
          .setLngLat([pickup.longitude, pickup.latitude])
          .setPopup(
            new Popup({ offset: 28 }).setText(
              `Điểm đón: ${pickup.displayLabel}`,
            ),
          )
          .addTo(map);
    });
    const resize = new ResizeObserver(() => {
      map.resize();
      if (container.current && container.current.clientWidth > 0) {
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
