import { distanceKm, rankClinics } from "../src/lib/clinic-distance";

it("ranks located clinics by distance and keeps unlocated clinics in the directory", () => {
  const position = { latitude: 40.991, longitude: 29.0277 };
  const clinics = [
    { name: "Unknown", latitude: null, longitude: null },
    { name: "Far", latitude: 41.0602, longitude: 28.9877 },
    { name: "Near", latitude: 40.991, longitude: 29.0277 },
  ];
  const ranked = rankClinics(clinics, position);
  expect(ranked.map((item) => item.clinic.name)).toEqual([
    "Near",
    "Far",
    "Unknown",
  ]);
  expect(ranked[0].distanceKm).toBe(0);
  expect(ranked[2].distanceKm).toBeNull();
  expect(distanceKm(position, { latitude: 40.991, longitude: 30.0277 })).toBeGreaterThan(80);
});
