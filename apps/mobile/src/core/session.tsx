import type { AuthSessionResponse } from "@dike/api-client-ts";
import { useQueryClient } from "@tanstack/react-query";
import { sessionStorage as SecureStore } from "./session-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  type LocalPersona,
  createMobileApi,
  MobileApiError,
  setSessionExpiredHandler,
} from "./api";
import { googleLogin } from "./google-login";

const TOKEN_KEY = "dike.mobile.session";

type SessionContextValue = {
  loading: boolean;
  session: AuthSessionResponse | null;
  token: string | null;
  sessionError: string | null;
  signInLocally: (persona: LocalPersona) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSessionError(null);
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
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Không thể khôi phục phiên. Hãy thử lại.",
      );
      if (error instanceof MobileApiError && error.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setToken(null);
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void SecureStore.deleteItemAsync(TOKEN_KEY);
      queryClient.clear();
      setToken(null);
      setSession(null);
      setSessionError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    });
    return () => setSessionExpiredHandler(undefined);
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading,
      session,
      token,
      sessionError,
      refresh,
      signInLocally: async (persona) => {
        if (!__DEV__)
          throw new Error("Local login is only available in development.");
        const result = await createMobileApi(() =>
          Promise.resolve(null),
        ).localLogin(persona);
        const authenticated = await createMobileApi(() =>
          Promise.resolve(result.token),
        ).session();
        if (!authenticated.authenticated)
          throw new Error("Invalid login session.");
        await SecureStore.setItemAsync(TOKEN_KEY, result.token);
        setSessionError(null);
        queryClient.clear();
        setToken(result.token);
        setSession(authenticated);
      },
      signInWithGoogle: async () => {
        const nextToken = await googleLogin();
        if (!nextToken) throw new Error("Bạn đã hủy đăng nhập Google.");
        const authenticated = await createMobileApi(() =>
          Promise.resolve(nextToken),
        ).session();
        if (!authenticated.authenticated)
          throw new Error("Phiên đăng nhập không hợp lệ.");
        await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
        setSessionError(null);
        queryClient.clear();
        setToken(nextToken);
        setSession(authenticated);
      },
      signOut: async () => {
        if (token) {
          try {
            await createMobileApi(() => Promise.resolve(token)).logout();
          } catch (error) {
            if (!(error instanceof MobileApiError && error.status === 401))
              throw error;
          }
        }
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        queryClient.clear();
        setToken(null);
        setSession(null);
      },
    }),
    [loading, queryClient, refresh, session, sessionError, token],
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
