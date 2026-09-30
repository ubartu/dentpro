export type Dentition = "adult" | "child";

export function quadrants(mode: Dentition) {
  const first = mode === "adult" ? 1 : 5;
  const count = mode === "adult" ? 8 : 5;
  return [
    { quadrant: first, label: "Upper right", upper: true, right: true },
    { quadrant: first + 1, label: "Upper left", upper: true, right: false },
    { quadrant: first + 3, label: "Lower right", upper: false, right: true },
    { quadrant: first + 2, label: "Lower left", upper: false, right: false },
  ].map((q) => ({
    ...q,
    teeth: Array.from({ length: count }, (_, i) => `${q.quadrant}${i + 1}`),
  }));
}

export function toothName(code: string) {
  if (code === "ALL") return "Whole mouth";
  if (!/^([1-4][1-8]|[5-8][1-5])$/.test(code)) return "Choose a tooth";
  const quadrant = Number(code[0]);
  const child = quadrant > 4;
  const position = Number(code[1]);
  const side = ["Upper right", "Upper left", "Lower left", "Lower right"][
    (quadrant - 1) % 4
  ];
  const names = child
    ? [
        "central incisor",
        "lateral incisor",
        "canine",
        "first molar",
        "second molar",
      ]
    : [
        "central incisor",
        "lateral incisor",
        "canine",
        "first premolar",
        "second premolar",
        "first molar",
        "second molar",
        "third molar",
      ];
  return `${side} ${child ? "primary" : "permanent"} ${names[position - 1]}`;
}
