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
      {error && <Text style={styles.muted}>Bağlantı açılamadı.</Text>}
    </>
  );
}

export function ClinicSocialProfiles({ clinic }: { clinic: Clinic }) {
  return (
    <>
      {(clinic.social_links || []).length > 0 && (
        <View style={local.socials}>
          <Text style={styles.muted}>Klinik tarafından eklenen sosyal medya hesapları</Text>
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
              title="Google puanını ve fotoğrafını göster"
              secondary
              busy={loading}
              onPress={load}
            />
          )}
          {!!error && <Notice text={error} error />}
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
                  : "Google puanı bulunmuyor"}
                {profile.review_count != null
                  ? ` · ${profile.review_count} yorum`
                  : ""}
              </Text>
              <Text style={styles.muted}>
                Google kullanıcı puanları klinik kalite değerlendirmesi değildir.
              </Text>
              {profile.photo && (
                <>
                  {failedPhoto !== profile.photo.uri && (
                    <Image
                      source={{ uri: profile.photo.uri }}
                      cachePolicy="none"
                      contentFit="cover"
                      accessibilityLabel={`${clinic.name} için Google Haritalar fotoğrafı`}
                      style={local.photo}
                      onError={() => setFailedPhoto(profile.photo!.uri)}
                    />
                  )}
                  {(profile.photo.authors || []).map((author, index) => (
                    <View key={index} style={styles.row}>
                      {!!author.avatar_url && (
                        <Image
                          source={{ uri: author.avatar_url }}
                          cachePolicy="none"
                          style={{ width: 24, height: 24, borderRadius: 12 }}
                          accessibilityLabel={author.name}
                        />
                      )}
                      {author.profile_url ? (
                        <ExternalLink
                          title={`Fotoğraf: ${author.name}`}
                          url={author.profile_url}
                        />
                      ) : (
                        <Text style={styles.muted}>Fotoğraf: {author.name}</Text>
                      )}
                    </View>
                  ))}
                  {!!profile.photo.google_maps_url && (
                    <ExternalLink
                      title="Kaynak fotoğrafı Google Haritalar'da gör"
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
              {!!profile.google_maps_url && (
                <ExternalLink
                  title="Kliniği Google Haritalar'da gör"
                  url={profile.google_maps_url}
                />
              )}
              {!!profile.website_url && (
                <ExternalLink
                  title="Klinik web sitesi"
                  url={profile.website_url}
                />
              )}
            </>
          )}
          {profile && profile.status !== "ready" && (
            <Text style={styles.muted}>
              {profile.status === "disabled"
                ? "Google puanı ve fotoğrafları henüz bağlı değil."
                : profile.status === "not_linked"
                  ? "Bu kliniğe bağlı bir Google profili yok."
                  : "Google bilgileri geçici olarak kullanılamıyor. Bu kliniği yine de seçebilirsiniz."}
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
