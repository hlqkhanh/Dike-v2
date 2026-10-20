import type { AuthSessionResponse } from "@dike/api-client-ts";
import { useQueryClient } from "@tanstack/react-query";
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

import { createMobileApi, type LocalPersona } from "./api";

const TOKEN_KEY = "dike.mobile.session";

type SessionContextValue = {
  loading: boolean;
  session: AuthSessionResponse | null;
  token: string | null;
  signInWithToken: (token: string) => Promise<void>;
  signInLocally: (persona: LocalPersona) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
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
      queryClient.clear();
      setToken(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  const signInWithToken = useCallback(
    async (nextToken: string) => {
      const normalized = nextToken.trim();
      if (!normalized) throw new Error("Thiếu phiên đăng nhập.");
      const nextSession = await createMobileApi(() =>
        Promise.resolve(normalized),
      ).session();
      if (!nextSession.authenticated)
        throw new Error("Phiên đăng nhập không hợp lệ.");
      await SecureStore.setItemAsync(TOKEN_KEY, normalized);
      queryClient.clear();
      setToken(normalized);
      setSession(nextSession);
      setLoading(false);
    },
    [queryClient],
  );

  useEffect(() => void refresh(), [refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading,
      session,
      token,
      refresh,
      signInWithToken,
      signInLocally: async (persona) => {
        if (!__DEV__)
          throw new Error("Đăng nhập local chỉ dùng trong bản phát triển.");
        const result = await createMobileApi(() =>
          Promise.resolve(null),
        ).localLogin(persona);
        await signInWithToken(result.token);
      },
      signOut: async () => {
        if (token) {
          await createMobileApi(() => Promise.resolve(token))
            .logout()
            .catch(() => undefined);
        }
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        queryClient.clear();
        setToken(null);
        setSession(null);
      },
    }),
    [loading, refresh, session, token, signInWithToken, queryClient],
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
