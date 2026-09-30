import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Button, Notice, colors, fonts, styles } from "./ui";
import { Clinic, GooglePlaceProfile } from "../lib/types";

function ExternalLink({ title, url }: { title: string; url: string }) {
  const [error, setError] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={title}
        onPress={() => {
          setError(false);
          void Linking.openURL(url).catch(() => setError(true));
        }}
        style={local.link}
      >
        <Text style={local.linkText}>{title} ↗</Text>
      </Pressable>
      {error && <Text style={styles.muted}>Could not open this link.</Text>}
    </>
  );
}

export function ClinicSocialProfiles({ clinic }: { clinic: Clinic }) {
  return (
    <>
      {" "}
      {(clinic.social_links || []).length > 0 && (
        <View style={local.socials}>
          <Text style={styles.muted}>Profiles supplied by the clinic</Text>
          <View style={styles.row}>
            {clinic.social_links.map((link) => (
              <ExternalLink
                key={link.platform}
                title={
                  link.platform === "x"
                    ? "X"
                    : link.platform[0].toUpperCase() + link.platform.slice(1)
                }
                url={link.url}
              />
            ))}
          </View>
        </View>
      )}
    </>
  );
}

export function ClinicDiscovery({
  clinic,
  profile,
  loading,
  error,
  load,
}: {
  clinic: Clinic;
  profile?: GooglePlaceProfile;
  loading: boolean;
  error?: string;
  load: () => void;
}) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  return (
    <>
      <ClinicSocialProfiles clinic={clinic} />
      {clinic.google_linked && (
        <View style={local.google}>
          {!profile && (
            <Button
              title="Show Google rating & photo"
              secondary
              busy={loading}
              onPress={load}
            />
          )}
          {error && <Notice text={error} error />}
          {profile?.status === "ready" && (
            <>
              <View style={local.attribution}>
                <Image
                  source={require("../../assets/google-maps-logo.png")}
                  accessibilityLabel="Google Maps"
                  style={{ width: 98, height: 18 }}
                  contentFit="contain"
                />
              </View>
              <Text style={local.rating}>
                {profile.rating != null
                  ? `★ ${profile.rating.toFixed(1)} / 5`
                  : "No Google rating available"}
                {profile.review_count != null
                  ? ` · ${profile.review_count} reviews`
                  : ""}
              </Text>
              <Text style={styles.muted}>
                Google user ratings are not a clinical quality assessment.
              </Text>
              {profile.photo && (
                <>
                  {failedPhoto !== profile.photo.uri && (
                    <Image
                      source={{ uri: profile.photo.uri }}
                      cachePolicy="none"
                      contentFit="cover"
                      accessibilityLabel={`${clinic.name} photo from Google Maps`}
                      style={local.photo}
                      onError={() => setFailedPhoto(profile.photo!.uri)}
                    />
                  )}
                  {(profile.photo.authors || []).map((author, index) => (
                    <View key={index} style={styles.row}>
                      {author.avatar_url && (
                        <Image
                          source={{ uri: author.avatar_url }}
                          cachePolicy="none"
                          style={{ width: 24, height: 24, borderRadius: 12 }}
                          accessibilityLabel={author.name}
                        />
                      )}
                      {author.profile_url ? (
                        <ExternalLink
                          title={`Photo: ${author.name}`}
                          url={author.profile_url}
                        />
                      ) : (
                        <Text style={styles.muted}>Photo: {author.name}</Text>
                      )}
                    </View>
                  ))}
                  {profile.photo.google_maps_url && (
                    <ExternalLink
                      title="View source photo on Google Maps"
                      url={profile.photo.google_maps_url}
                    />
                  )}
                </>
              )}
              {(profile.attributions || []).map((provider, index) =>
                provider.uri ? (
                  <ExternalLink
                    key={index}
                    title={provider.name}
                    url={provider.uri}
                  />
                ) : (
                  <Text key={index} style={styles.muted}>
                    {provider.name}
                  </Text>
                ),
              )}
              {profile.google_maps_url && (
                <ExternalLink
                  title="View clinic on Google Maps"
                  url={profile.google_maps_url}
                />
              )}
              {profile.website_url && (
                <ExternalLink
                  title="Clinic website"
                  url={profile.website_url}
                />
              )}
            </>
          )}
          {profile && profile.status !== "ready" && (
            <Text style={styles.muted}>
              {profile.status === "disabled"
                ? "Google rating and photos are not connected yet."
                : profile.status === "not_linked"
                  ? "No Google profile linked to this clinic."
                  : "Google information is temporarily unavailable. You can still select this clinic."}
            </Text>
          )}
        </View>
      )}
    </>
  );
}

const local = StyleSheet.create({
  socials: { gap: 8 },
  google: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 10,
  },
  attribution: {
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 5,
    alignSelf: "flex-start",
  },
  rating: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  photo: {
    width: "100%",
    height: 170,
    borderRadius: 12,
    backgroundColor: colors.pale,
  },
  link: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  linkText: { fontFamily: fonts.medium, fontSize: 13, color: colors.blue },
});
