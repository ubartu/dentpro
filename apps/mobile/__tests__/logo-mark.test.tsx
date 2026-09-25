import { act, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, AppState } from "react-native";
import { LogoMark } from "../src/components/logo-mark";

it("stops the loading rotation when reduced motion is enabled", async () => {
  const previousState = AppState.currentState;
  AppState.currentState = "active";
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest
    .spyOn(Animated, "loop")
    .mockReturnValue({ start, stop, reset: jest.fn() });
  const preference = jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
  const listen = jest.spyOn(AccessibilityInfo, "addEventListener");
  const view = render(<LogoMark loading />);
  try {
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    const calls = listen.mock.calls as unknown as [
      string,
      (enabled: boolean) => void,
    ][];
    const motion = calls.find(
      ([event]) => event === "reduceMotionChanged",
    )?.[1];
    expect(motion).toBeDefined();
    await act(async () => {
      motion?.(true);
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    loop.mockRestore();
    preference.mockRestore();
    listen.mockRestore();
    AppState.currentState = previousState;
  }
});
