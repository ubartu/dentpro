export type Coordinates = { latitude: number; longitude: number };

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const arc =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function rankClinics<
  T extends { name: string; latitude: number | null; longitude: number | null },
>(clinics: T[], position: Coordinates | null) {
  return clinics
    .map((clinic) => ({
      clinic,
      distanceKm:
        position && clinic.latitude != null && clinic.longitude != null
          ? distanceKm(position, {
              latitude: clinic.latitude,
              longitude: clinic.longitude,
            })
          : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null)
        return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return a.clinic.name.localeCompare(b.clinic.name);
    });
}
