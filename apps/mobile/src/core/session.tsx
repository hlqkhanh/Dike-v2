import type { AuthSessionResponse } from "@dike/api-client-ts";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { createMobileApi } from "./api";

const TOKEN_KEY = "dike.mobile.session";

type SessionContextValue = {
  loading: boolean;
  session: AuthSessionResponse | null;
  token: string | null;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSessionResponse | null>(null);

  const refresh = useCallback(async () => {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY);
    setToken(stored);
    if (!stored) {
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      setSession(
        await createMobileApi(() => Promise.resolve(stored)).session(),
      );
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading,
      session,
      token,
      refresh,
      signInWithToken: async (nextToken) => {
        const normalized = nextToken.trim();
        await SecureStore.setItemAsync(TOKEN_KEY, normalized);
        setLoading(true);
        await refresh();
      },
      signOut: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setSession(null);
      },
    }),
    [loading, refresh, session, token],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
