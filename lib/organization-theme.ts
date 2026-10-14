/** Derive accessible, consistent portal colors from a single organization color. */
export function organizationTheme(
  input?: string | null,
): Record<string, string> {
  const primary = /^#[0-9a-fA-F]{6}$/.test(input || "") ? input! : "#275e72";
  const rgb = [1, 3, 5].map((i) => parseInt(primary.slice(i, i + 2), 16));
  const mix = (target: number[], amount: number) =>
    "#" +
    rgb
      .map((v, i) =>
        Math.round(v * (1 - amount) + target[i] * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const luminance = rgb
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  return {
    "--club-primary": primary,
    "--club-accent": mix([255, 255, 255], 0.25),
    "--club-bg": "#f5f7fa",
    "--club-surface": "#ffffff",
    "--club-text": "#172434",
    "--club-primary-soft": mix([255, 255, 255], 0.9),
    "--club-primary-dark": mix([0, 0, 0], 0.25),
    "--club-primary-text": mix([0, 0, 0], 0.6),
    "--club-on-primary": luminance > 0.179 ? "#000000" : "#ffffff",
  };
}
