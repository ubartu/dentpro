import type { ExpoConfig } from "expo/config";
const release = process.env.EAS_BUILD_PROFILE === "production";
const config: ExpoConfig = {
  name: "DENTpro",
  slug: "dentpro-patient",
  version: "1.0.0",
  scheme: "dentpro",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/dentpro-brand-square.png",
  platforms: ["ios", "android"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.dentpro.patient",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(release
        ? {}
        : { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } }),
    },
  },
  android: {
    package: "com.dentpro.patient",
    adaptiveIcon: {
      foregroundImage: "./assets/dentpro-brand-adaptive.png",
      backgroundColor: "#FFFFFF",
    },
    permissions: [],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-document-picker",
    "expo-image",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow DENTpro to use your location to show nearby participating clinics.",
      },
    ],
    "expo-font",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/dentpro-brand-square.png",
        imageWidth: 160,
      },
    ],
    ["expo-build-properties", { android: { usesCleartextTraffic: !release } }],
  ],
};
export default config;
