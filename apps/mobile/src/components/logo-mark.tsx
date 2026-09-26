import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  View,
  useAnimatedValue,
} from "react-native";

const logo = require("../../assets/dentpro-brand-square.png");

export function LogoMark({
  loading = false,
  size = 32,
}: {
  loading?: boolean;
  size?: number;
}) {
  const progress = useAnimatedValue(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    const app = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);
  useEffect(() => {
    if (!loading || reduceMotion || !active) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [loading, reduceMotion, active, progress]);
  const rotateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={loading ? "DENTpro loading" : "DENTpro logo"}
      accessibilityState={{ busy: loading }}
      style={{ width: size, height: size }}
    >
      <Animated.Image
        source={logo}
        resizeMode="contain"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.16,
          transform: [{ perspective: size * 7 }, { rotateY }],
        }}
      />
    </View>
  );
}
