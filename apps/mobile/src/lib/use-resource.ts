import { useCallback, useRef, useState, type SetStateAction } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError, errorMessage, request } from "./api";
import { useSession } from "./session";

type Scope = {
  identity: string;
  active: boolean;
  revision: number;
  pending: Promise<void> | null;
  queued: Promise<void> | null;
};
type Resource<T> = {
  identity: string;
  data: T | null;
  error: string;
  loading: boolean;
};

export function useResource<T>(path: string, method = "GET") {
  const { token, expire } = useSession();
  const identity = JSON.stringify([token, path, method]);
  const [state, setState] = useState<Resource<T>>({
    identity,
    data: null,
    error: "",
    loading: !!token,
  });
  const focused = useRef<Scope | null>(null);

  const load = useCallback(
    (scope: Scope): Promise<void> => {
      if (!token || !scope.active || scope.identity !== identity)
        return Promise.resolve();
      if (scope.pending) return scope.pending;
      const revision = scope.revision;
      const isCurrent = () => scope.active && scope.revision === revision;
      setState((previous) => ({
        identity,
        data: previous.identity === identity ? previous.data : null,
        error: previous.identity === identity ? previous.error : "",
        loading: true,
      }));
      scope.pending = (async () => {
        try {
          const data = await request<T>(path, token, method);
          if (isCurrent()) setState({ identity, data, error: "", loading: false });
        } catch (error) {
          if (!isCurrent()) return;
          const unavailable =
            error instanceof ApiError && [401, 403, 404].includes(error.status);
          setState((previous) => ({
            identity,
            data:
              !unavailable && previous.identity === identity
                ? previous.data
                : null,
            error: errorMessage(error),
            loading: false,
          }));
          if (error instanceof ApiError && error.status === 401) {
            // Stop queued work immediately, before session removal rerenders us.
            scope.active = false;
            void expire().catch(() => {});
          }
        } finally {
          scope.pending = null;
        }
      })();
      return scope.pending;
    },
    [token, path, method, identity, expire],
  );

  const refresh = useCallback((): Promise<void> => {
    const scope = focused.current;
    if (!scope?.active || scope.identity !== identity) return Promise.resolve();
    if (scope.queued) return scope.queued;
    if (!scope.pending) return load(scope);
    // An explicit refresh can follow a mutation. Do one fresh read after the
    // older request finishes and do not let its stale result undo that mutation.
    ++scope.revision;
    scope.queued = scope.pending.then(() => {
      scope.queued = null;
      return load(scope);
    });
    return scope.queued;
  }, [identity, load]);

  useFocusEffect(
    useCallback(() => {
      const scope: Scope = {
        identity,
        active: true,
        revision: 0,
        pending: null,
        queued: null,
      };
      focused.current = scope;
      void load(scope);
      const backgroundRefresh = () => {
        // The API timeout is longer than the polling interval. Never supersede
        // an in-flight read with a poll, or slow responses can be starved forever.
        if (AppState.currentState === "active" && !scope.pending)
          void load(scope);
      };
      const interval = setInterval(backgroundRefresh, 15000);
      const sub = AppState.addEventListener("change", (next) => {
        if (next === "active") backgroundRefresh();
      });
      return () => {
        scope.active = false;
        clearInterval(interval);
        sub.remove();
      };
    }, [identity, load]),
  );

  const setData = useCallback(
    (update: SetStateAction<T | null>) => {
      const scope = focused.current;
      if (!scope?.active || scope.identity !== identity) return;
      ++scope.revision;
      setState((previous) => {
        const data = previous.identity === identity ? previous.data : null;
        return {
          identity,
          data:
            typeof update === "function"
              ? (update as (value: T | null) => T | null)(data)
              : update,
          error: "",
          loading: false,
        };
      });
    },
    [identity],
  );

  // Mask the previous identity synchronously, before focus-effect cleanup runs.
  const current = state.identity === identity;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    loading: current ? state.loading : !!token,
    refresh,
    setData,
  };
}
