import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LogoMark } from "./logo-mark";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  ink: "#203454",
  muted: "#697C96",
  blue: "#246BEB",
  pale: "#EFF6FF",
  sky: "#DCEEFF",
  paper: "#FFFFFF",
  border: "#E6EDF6",
  danger: "#B13D4B",
  amber: "#865C22",
};
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: {
    padding: 24,
    gap: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fonts.bold,
    letterSpacing: -0.7,
    lineHeight: 36,
  },
  heading: {
    color: colors.ink,
    fontSize: 19,
    fontFamily: fonts.bold,
    letterSpacing: -0.4,
  },
  text: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.regular,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  badge: {
    color: colors.blue,
    backgroundColor: colors.pale,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  input: {
    color: colors.ink,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 52,
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  button: {
    backgroundColor: colors.blue,
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFF", fontFamily: fonts.semibold, fontSize: 14 },
});
export function Screen({
  children,
  refresh,
  refreshing = false,
  contentStyle,
  topInset = false,
}: React.PropsWithChildren<{
  refresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  topInset?: boolean;
}>) {
  return (
    <SafeAreaView
      edges={
        topInset
          ? ["top", "left", "right", "bottom"]
          : ["left", "right", "bottom"]
      }
      style={styles.page}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={colors.blue}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
    </View>
  );
}
export function Card({
  children,
  style,
}: React.PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
  busy = false,
  quiet = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  busy?: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && { backgroundColor: colors.pale },
        quiet && { backgroundColor: "transparent" },
        { overflow: "hidden" },
        { opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      {!secondary && !quiet && (
        <LinearGradient
          pointerEvents="none"
          colors={["#3473D9", colors.blue]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {busy ? (
        <ActivityIndicator color={secondary || quiet ? colors.blue : "#FFF"} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            (secondary || quiet) && { color: colors.blue },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  secureTextEntry,
  ...props
}: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.muted, { fontFamily: fonts.medium }]}>{label}</Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          {...props}
          secureTextEntry={secureTextEntry && !show}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            focused && { borderColor: colors.blue, backgroundColor: "#FAFCFF" },
            secureTextEntry && { paddingRight: 54 },
            props.style,
          ]}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              show
                ? `Hide ${label.toLowerCase()}`
                : `Show ${label.toLowerCase()}`
            }
            onPress={() => setShow(!show)}
            style={{ position: "absolute", right: 0, padding: 16 }}
          >
            <Ionicons
              name={show ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function Brand() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <LogoMark size={28} />
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 21,
          color: colors.ink,
          letterSpacing: -0.8,
        }}
      >
        DENT<Text style={{ color: colors.blue }}>pro</Text>
      </Text>
    </View>
  );
}
export function Section({
  title,
  detail,
  children,
  initiallyOpen = false,
}: React.PropsWithChildren<{
  title: string;
  detail?: string;
  initiallyOpen?: boolean;
}>) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 44,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.heading}>{title}</Text>
          {detail && <Text style={styles.muted}>{detail}</Text>}
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={19}
          color={colors.blue}
        />
      </Pressable>
      {open && <View style={{ gap: 14 }}>{children}</View>}
    </Card>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  if (!text) return null;
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[
        styles.muted,
        {
          backgroundColor: error ? "#FCEDEA" : colors.pale,
          color: error ? colors.danger : colors.ink,
          padding: 14,
          borderRadius: 12,
        },
      ]}
    >
      {text}
    </Text>
  );
}
export function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      onPress={onChange}
      disabled={disabled}
      style={[styles.row, { flexWrap: "nowrap", paddingVertical: 12 }]}
    >
      <View
        style={{
          width: 25,
          height: 25,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: colors.blue,
          backgroundColor: checked ? colors.blue : "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>
          {checked ? "✓" : ""}
        </Text>
      </View>
      <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function Loading() {
  return (
    <ActivityIndicator
      accessibilityLabel="Loading"
      size="large"
      color={colors.blue}
      style={{ marginVertical: 30 }}
    />
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
    </Card>
  );
}

export function LoadingBrand({
  title = "Opening your care space",
  detail = "Just a moment…",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        minHeight: 220,
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        paddingVertical: 32,
      }}
    >
      <View
        style={{
          width: 132,
          height: 132,
          borderRadius: 66,
          backgroundColor: colors.pale,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LogoMark size={76} loading />
      </View>
      <Text style={[styles.heading, { textAlign: "center" }]}>{title}</Text>
      <Text style={[styles.muted, { textAlign: "center" }]}>{detail}</Text>
    </View>
  );
}
