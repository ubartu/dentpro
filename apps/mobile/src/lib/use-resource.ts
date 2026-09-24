import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError, errorMessage, request } from "./api";
import { useSession } from "./session";
export function useResource<T>(path: string, method = "GET") {
  const { token, expire } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!token) return;
    setLoading(true);
    try {
      const next = await request<T>(path, token, method);
      if (generation.current === current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (generation.current !== current) return;
      setData(null);
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 401) void expire();
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [token, path, method, expire]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const interval = setInterval(() => {
        if (AppState.currentState === "active") void refresh();
      }, 15000);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") void refresh();
      });
      return () => {
        ++generation.current;
        clearInterval(interval);
        sub.remove();
      };
    }, [refresh]),
  );
  return { data, error, loading, refresh, setData };
}
