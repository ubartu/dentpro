import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  View,
  useAnimatedValue,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/** A layered badge with native perspective rotation; no WebView or 3D runtime. */
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
      {[0, 1, 2, 3, 4, 5].map((layer) => (
        <Animated.View
          key={layer}
          style={{
            ...StyleSheet.absoluteFill,
            borderRadius: size * 0.28,
            backgroundColor: [
              "#103D9E",
              "#1448B5",
              "#1957C8",
              "#2468DC",
              "#347AEC",
              "#246BEB",
            ][layer],
            transform: [
              { perspective: size * 7 },
              {
                translateX: progress.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [
                    0,
                    (5 - layer) * size * 0.027,
                    0,
                    -(5 - layer) * size * 0.027,
                    0,
                  ],
                }),
              },
              { rotateY },
              { rotateX: loading && !reduceMotion ? "-12deg" : "0deg" },
            ],
          }}
        >
          {layer === 5 && (
            <LinearGradient
              colors={["#72B1FF", "#317BEF", "#195BDE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                borderRadius: size * 0.28,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#76AEFF",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: size * 0.52,
                  height: size * 0.09,
                  borderRadius: size * 0.025,
                  backgroundColor: "white",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  height: size * 0.52,
                  width: size * 0.09,
                  borderRadius: size * 0.025,
                  backgroundColor: "white",
                }}
              />
            </LinearGradient>
          )}
        </Animated.View>
      ))}
    </View>
  );
}
