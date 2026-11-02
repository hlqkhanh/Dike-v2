import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Animated, View, useWindowDimensions } from "react-native";

type Listener = () => void;
const MapViewportContext = createContext<{
  subscribe: (listener: Listener) => () => void;
  notify: Listener;
} | null>(null);

export function MapViewportProvider({
  scrollY,
  children,
}: PropsWithChildren<{ scrollY: Animated.Value }>) {
  const listeners = useRef(new Set<Listener>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      listeners.current.forEach((listener) => listener());
    }, 100);
  }, []);
  const subscribe = useCallback(
    (listener: Listener) => {
      listeners.current.add(listener);
      notify();
      return () => {
        listeners.current.delete(listener);
      };
    },
    [notify],
  );
  useEffect(() => {
    const id = scrollY.addListener(notify);
    return () => {
      scrollY.removeListener(id);
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [scrollY, notify]);
  const value = useMemo(() => ({ subscribe, notify }), [subscribe, notify]);
  return (
    <MapViewportContext.Provider value={value}>
      {children}
    </MapViewportContext.Provider>
  );
}

export function useMapViewport() {
  const viewport = useContext(MapViewportContext);
  const ref = useRef<View>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [active, setActive] = useState(!viewport);
  useEffect(() => {
    if (!viewport) return;
    let mounted = true;
    const unsubscribe = viewport.subscribe(() => {
      ref.current?.measureInWindow((_x, y, width, height) => {
        if (!mounted || width <= 0 || height <= 0) return;
        setActive((previous) => {
          // Preload nearby maps; retain them farther away to avoid churn on small scrolls.
          const margin = previous ? windowHeight : 250;
          return y < windowHeight + margin && y + height > -margin;
        });
      });
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [viewport, windowHeight, windowWidth]);
  return { ref, active, onLayout: viewport?.notify };
}
