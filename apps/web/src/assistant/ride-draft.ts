import type {
  PlaceResponse,
  RouteResponse,
  ContributionEstimate,
} from "../routing/api";
import type { QueryClient } from "@tanstack/react-query";

export type AssistantRideDraft = {
  fields: Record<string, string>;
  origin?: PlaceResponse;
  destination?: PlaceResponse;
  createdAt: number;
  route?: RouteResponse;
  estimate?: ContributionEstimate;
};

export const assistantRideDraftKey = (userId: string, id: string) =>
  ["assistant", "ride-draft", userId, id] as const;

const storageKey = (userId: string, id: string) =>
  `dike.assistant.ride.${encodeURIComponent(userId)}.${id}`;

export function saveAssistantRideDraft(
  client: QueryClient,
  userId: string,
  id: string,
  draft: AssistantRideDraft,
) {
  client.setQueryData(assistantRideDraftKey(userId, id), draft);
  try {
    sessionStorage.setItem(storageKey(userId, id), JSON.stringify(draft));
  } catch {
    /* Memory still supports in-app navigation. */
  }
}

export function readAssistantRideDraft(
  client: QueryClient,
  userId: string,
  id: string,
): AssistantRideDraft | undefined {
  const cached = client.getQueryData<AssistantRideDraft>(
    assistantRideDraftKey(userId, id),
  );
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(storageKey(userId, id));
    if (!raw) return;
    const draft = JSON.parse(raw) as AssistantRideDraft;
    if (
      !draft.fields ||
      typeof draft.createdAt !== "number" ||
      Date.now() - draft.createdAt > 30 * 60 * 1000
    ) {
      sessionStorage.removeItem(storageKey(userId, id));
      return;
    }
    return draft;
  } catch {
    return;
  }
}
