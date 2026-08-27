export const DEFAULT_TITLE_FONT_SIZE = 22;
export const MIN_TITLE_FONT_SIZE = 14;
export const MAX_TITLE_FONT_SIZE = 48;

export function normalizeTitleFontSize(value, fallback = DEFAULT_TITLE_FONT_SIZE) {
  const size = value === undefined ? fallback : Number(value);
  return Number.isFinite(size) &&
    size >= MIN_TITLE_FONT_SIZE &&
    size <= MAX_TITLE_FONT_SIZE
    ? size
    : null;
}
