import { useRef, useState } from "react";
import { ApiError, errorMessage } from "./api";
import { useSession } from "./session";
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const { expire } = useSession();
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 401) await expire();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
