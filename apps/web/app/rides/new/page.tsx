import { UnifiedRideFlow } from "./unified-ride-flow";

export default async function NewRidePage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    route?: string;
    assistantDraft?: string;
  }>;
}) {
  const { mode, route, assistantDraft } = await searchParams;
  return (
    <UnifiedRideFlow
      key={assistantDraft ?? route ?? mode ?? "new"}
      initialMode={mode === "driver" ? "driver" : "passenger"}
      initialRouteId={typeof route === "string" ? route : undefined}
      initialAssistantDraftId={
        typeof assistantDraft === "string" ? assistantDraft : undefined
      }
    />
  );
}
