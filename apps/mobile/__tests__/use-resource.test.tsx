import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { ApiError, request } from "../src/lib/api";
import { useResource } from "../src/lib/use-resource";

let mockToken: string | null = "patient-a";
let mockFocused = true;
const mockExpire = jest.fn();
const mockRemove = jest.fn();
let appStateChanged: (state: AppStateStatus) => void;
jest.mock("../src/lib/session", () => ({
  useSession: () => ({ token: mockToken, expire: mockExpire }),
}));
jest.mock("../src/lib/api", () => ({
  ...jest.requireActual("../src/lib/api"),
  request: jest.fn(),
}));
jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    useFocusEffect(effect: () => void | (() => void)) {
      React.useEffect(() => {
        if (mockFocused) return effect();
      }, [effect, mockFocused]);
    },
  };
});
const api = jest.mocked(request);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  api.mockReset();
  mockToken = "patient-a";
  mockFocused = true;
  mockExpire.mockResolvedValue(undefined);
  AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
    appStateChanged = listener;
    return { remove: mockRemove };
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("lets a response slower than the polling interval finish without overlapping requests", async () => {
  const slow = deferred<string[]>();
  api.mockReturnValue(slow.promise);
  const { result } = renderHook(() => useResource<string[]>("/cases"));
  await act(async () => {
    jest.advanceTimersByTime(15000);
    appStateChanged("active");
  });
  expect(api).toHaveBeenCalledTimes(1);
  await act(async () => slow.resolve(["case-a"]));
  expect(result.current).toMatchObject({
    data: ["case-a"], loading: false, error: "",
  });
});

it("shows a 20-second timeout and retries on the next poll instead of loading forever", async () => {
  api.mockImplementationOnce(() => new Promise((_, reject) => {
    setTimeout(() => reject(new ApiError(0, "Offline")), 20000);
  })).mockResolvedValueOnce(["recovered"]);
  const { result } = renderHook(() => useResource<string[]>("/cases"));
  await act(async () => jest.advanceTimersByTime(20000));
  expect(api).toHaveBeenCalledTimes(1);
  expect(result.current).toMatchObject({ data: null, loading: false, error: "Offline" });
  await act(async () => jest.advanceTimersByTime(10000));
  expect(result.current).toMatchObject({ data: ["recovered"], loading: false, error: "" });
});

it("keeps visible data on a transient refresh failure and clears the error after retry", async () => {
  api.mockResolvedValueOnce(["case-a"])
    .mockRejectedValueOnce(new ApiError(503, "Temporarily unavailable"))
    .mockResolvedValueOnce(["case-b"]);
  const { result } = renderHook(() => useResource<string[]>("/cases"));
  await act(async () => {});
  await act(async () => result.current.refresh());
  expect(result.current).toMatchObject({
    data: ["case-a"], loading: false, error: "Temporarily unavailable",
  });
  await act(async () => result.current.refresh());
  expect(result.current).toMatchObject({ data: ["case-b"], error: "", loading: false });
});

it("queues one explicit refresh after a mutation and never restores a deleted item from an older read", async () => {
  const old = deferred<string[]>();
  const fresh = deferred<string[]>();
  api.mockResolvedValueOnce(["keep", "deleted"])
    .mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const { result } = renderHook(() => useResource<string[]>("/cases"));
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(15000));
  let refresh!: Promise<void>;
  act(() => {
    result.current.setData((data) => data?.filter((id) => id !== "deleted") || []);
    refresh = result.current.refresh();
    expect(result.current.refresh()).toBe(refresh);
  });
  expect(api).toHaveBeenCalledTimes(2);
  await act(async () => old.resolve(["keep", "deleted"]));
  expect(api).toHaveBeenCalledTimes(3);
  expect(result.current.data).toEqual(["keep"]);
  await act(async () => {
    fresh.resolve(["keep", "new"]);
    await refresh;
  });
  expect(result.current).toMatchObject({ data: ["keep", "new"], loading: false });
});

it("hides prior account data immediately and ignores its late unauthorized response", async () => {
  const old = deferred<string[]>();
  const next = deferred<string[]>();
  api.mockResolvedValueOnce(["private-a"])
    .mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const renders: { token: string | null; data: string[] | null }[] = [];
  const { result, rerender } = renderHook(() => {
    const resource = useResource<string[]>("/cases");
    renders.push({ token: mockToken, data: resource.data });
    return resource;
  });
  await act(async () => {});
  await act(async () => jest.advanceTimersByTime(15000));
  mockToken = "patient-b";
  rerender(undefined);
  expect(result.current.data).toBeNull();
  expect(renders.filter((entry) => entry.token === "patient-b")
    .every((entry) => entry.data === null)).toBe(true);
  await act(async () => old.reject(new ApiError(401, "Expired old account")));
  expect(mockExpire).not.toHaveBeenCalled();
  await act(async () => next.resolve(["private-b"]));
  expect(result.current.data).toEqual(["private-b"]);
});

it("ignores results from the previous path and clears data when signed out", async () => {
  const first = deferred<string[]>();
  api.mockReturnValueOnce(first.promise).mockResolvedValueOnce(["second"]);
  const { result, rerender } = renderHook(({ path }: { path: string }) => useResource<string[]>(path), {
    initialProps: { path: "/cases/first" },
  });
  rerender({ path: "/cases/second" });
  await act(async () => {});
  await act(async () => first.resolve(["first"]));
  expect(result.current.data).toEqual(["second"]);
  mockToken = null;
  rerender({ path: "/cases/second" });
  expect(result.current).toMatchObject({ data: null, error: "", loading: false });
  await act(async () => jest.advanceTimersByTime(30000));
  expect(api).toHaveBeenCalledTimes(2);
});

it("stops polling and queued refreshes on blur, and reloads on refocus", async () => {
  const old = deferred<string[]>();
  api.mockReturnValueOnce(old.promise).mockResolvedValueOnce(["focused"]);
  const { result, rerender } = renderHook(() => useResource<string[]>("/cases"));
  let queued!: Promise<void>;
  act(() => { queued = result.current.refresh(); });
  mockFocused = false;
  rerender(undefined);
  await act(async () => {
    old.resolve(["blurred"]);
    await queued;
    jest.advanceTimersByTime(30000);
  });
  expect(result.current.data).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
  expect(mockRemove).toHaveBeenCalledTimes(1);
  mockFocused = true;
  rerender(undefined);
  await act(async () => {});
  expect(result.current.data).toEqual(["focused"]);
});

it("ignores a late unauthorized response after unmount and removes listeners", async () => {
  const pending = deferred<string[]>();
  api.mockReturnValueOnce(pending.promise);
  const { unmount } = renderHook(() => useResource<string[]>("/cases"));
  unmount();
  await act(async () => {
    pending.reject(new ApiError(401, "Expired"));
    jest.advanceTimersByTime(30000);
  });
  expect(mockExpire).not.toHaveBeenCalled();
  expect(mockRemove).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledTimes(1);
});

it("clears unauthorized cached data and expires the current session once", async () => {
  api.mockResolvedValueOnce(["private"])
    .mockRejectedValueOnce(new ApiError(401, "Expired"));
  const { result } = renderHook(() => useResource<string[]>("/cases"));
  await act(async () => {});
  await act(async () => result.current.refresh());
  expect(result.current).toMatchObject({ data: null, loading: false, error: "Expired" });
  expect(mockExpire).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(30000));
  expect(api).toHaveBeenCalledTimes(2);
});

it("pauses polling while backgrounded and refreshes on foreground", async () => {
  api.mockResolvedValueOnce(["initial"]).mockResolvedValueOnce(["resumed"]);
  const { result } = renderHook(() => useResource<string[]>("/cases"));
  await act(async () => {});
  AppState.currentState = "background";
  await act(async () => {
    appStateChanged("background");
    jest.advanceTimersByTime(30000);
  });
  expect(api).toHaveBeenCalledTimes(1);
  AppState.currentState = "active";
  await act(async () => appStateChanged("active"));
  expect(result.current.data).toEqual(["resumed"]);
});
