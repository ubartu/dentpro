import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { ApiError, request, errorMessage } from "./api";
import type { Patient, Session } from "./types";
const KEY = "dentpro-patient-session";
type Auth = {
  token: string | null;
  user: Patient | null;
  loading: boolean;
  error: string;
  restore: () => Promise<void>;
  accept: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  expire: () => Promise<void>;
  setUser: (user: Patient) => void;
};
const Context = createContext<Auth | null>(null);
async function readStoredSession(): Promise<Session | null> {
  const token = await SecureStore.getItemAsync(KEY);
  if (!token) return null;
  return { token, user: await request<Patient>("/patient/me", token) };
}
export function SessionProvider({ children }: React.PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const expire = useCallback(async () => {
    setToken(null);
    setUser(null);
    setError("");
    await SecureStore.deleteItemAsync(KEY);
  }, []);
  const applyRestored = useCallback((session: Session | null) => {
    setUser(session?.user || null);
    setToken(session?.token || null);
    setError("");
    setLoading(false);
  }, []);
  const restoreFailed = useCallback(
    async (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) await expire();
      else setError(errorMessage(e));
      setLoading(false);
    },
    [expire],
  );
  const restore = useCallback(async () => {
    setLoading(true);
    try {
      applyRestored(await readStoredSession());
    } catch (e) {
      await restoreFailed(e);
    }
  }, [applyRestored, restoreFailed]);
  useEffect(() => {
    let active = true;
    void readStoredSession().then(
      (session) => {
        if (active) applyRestored(session);
      },
      (error) => {
        if (active) void restoreFailed(error);
      },
    );
    return () => {
      active = false;
    };
  }, [applyRestored, restoreFailed]);
  const accept = async (session: Session) => {
    await SecureStore.setItemAsync(KEY, session.token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setToken(session.token);
    setUser(session.user);
    setError("");
  };
  const signOut = async () => {
    try {
      if (token) await request("/auth/logout", token, "POST");
    } finally {
      await expire();
    }
  };
  return (
    <Context.Provider
      value={{
        token,
        user,
        loading,
        error,
        restore,
        accept,
        signOut,
        expire,
        setUser,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing session provider");
  return context;
}
