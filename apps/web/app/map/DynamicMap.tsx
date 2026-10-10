"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { RoutePoint } from "../../src/routing/api";

const duckIcon = L.divIcon({
  html: '<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transform: scaleX(-1);">🚕</div>',
  className: "custom-duck-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const destinationIcon = L.divIcon({
  html: '<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📍</div>',
  className: "custom-dest-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

function MapBounds({ route }: { route: RoutePoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.length > 0) {
      const bounds = L.latLngBounds(
        route.map((p) => [p.latitude, p.longitude]),
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [route, map]);
  return null;
}

export default function DynamicMap({ route }: { route?: RoutePoint[] }) {
  const defaultCenter: [number, number] = [10.762622, 106.660172]; // HCMC Default
  const positions = useMemo(() => {
    return route
      ? route.map((p) => [p.latitude, p.longitude] as [number, number])
      : [];
  }, [route]);

  return (
    <div className="dynamic-map">
      <MapContainer
        center={positions.length > 0 ? positions[0] : defaultCenter}
        zoom={15}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {positions.length > 0 && (
          <>
            <Polyline
              positions={positions}
              color="#15803d"
              weight={6}
              opacity={0.8}
            />
            <Marker position={positions[0]} icon={duckIcon}>
              <Popup>Vịt Dike xuất phát!</Popup>
            </Marker>
            <Marker
              position={positions[positions.length - 1]}
              icon={destinationIcon}
            >
              <Popup>Điểm đến</Popup>
            </Marker>
            <MapBounds route={route!} />
          </>
        )}
      </MapContainer>
    </div>
  );
}
