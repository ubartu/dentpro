export type Dentition = "adult" | "child";

export function quadrants(mode: Dentition) {
  const first = mode === "adult" ? 1 : 5;
  const count = mode === "adult" ? 8 : 5;
  return [
    { quadrant: first, label: "Sağ üst", upper: true, right: true },
    { quadrant: first + 1, label: "Sol üst", upper: true, right: false },
    { quadrant: first + 3, label: "Sağ alt", upper: false, right: true },
    { quadrant: first + 2, label: "Sol alt", upper: false, right: false },
  ].map((q) => ({
    ...q,
    teeth: Array.from({ length: count }, (_, i) => `${q.quadrant}${i + 1}`),
  }));
}

export function toothName(code: string) {
  if (code === "ALL") return "Tüm ağız";
  if (!/^([1-4][1-8]|[5-8][1-5])$/.test(code)) return "Diş seçin";
  const quadrant = Number(code[0]);
  const child = quadrant > 4;
  const position = Number(code[1]);
  const side = ["Sağ üst", "Sol üst", "Sol alt", "Sağ alt"][(quadrant - 1) % 4];
  const names = child
    ? ["orta kesici", "yan kesici", "köpek dişi", "birinci azı", "ikinci azı"]
    : [
        "orta kesici",
        "yan kesici",
        "köpek dişi",
        "birinci küçük azı",
        "ikinci küçük azı",
        "birinci azı",
        "ikinci azı",
        "üçüncü azı",
      ];
  return `${side} ${child ? "süt" : "kalıcı"} ${names[position - 1]}`;
}
