import { UnifiedRideFlow } from "./unified-ride-flow";

export default async function NewRidePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return (
    <UnifiedRideFlow initialMode={mode === "driver" ? "driver" : "passenger"} />
  );
}
