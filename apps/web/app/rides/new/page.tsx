import { UnifiedRideFlow } from "./unified-ride-flow";

export default async function NewRidePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; route?: string }>;
}) {
  const { mode, route } = await searchParams;
  return (
    <UnifiedRideFlow
      initialMode={mode === "driver" ? "driver" : "passenger"}
      initialRouteId={typeof route === "string" ? route : undefined}
    />
  );
}
