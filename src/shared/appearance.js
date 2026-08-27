export const DEFAULT_MORE_ICON = 'mdi:dots-vertical';
export const TITLE_POSITIONS = new Set(['left', 'right']);

export function normalizeAccentColor(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const channels = value.slice(0, 3).map(Number);
  if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) {
    return null;
  }
  return `rgb(${channels.map(Math.round).join(' ')})`;
}

export function validateAppearance(config, cardName, { titlePosition = false } = {}) {
  if (config.accent_color !== undefined && normalizeAccentColor(config.accent_color) === null) {
    throw new Error(`${cardName}: "accent_color" must be an RGB color`);
  }
  if (
    titlePosition &&
    config.title_position !== undefined &&
    !TITLE_POSITIONS.has(config.title_position)
  ) {
    throw new Error(`${cardName}: "title_position" must be left or right`);
  }
  if (
    config.more_icon !== undefined &&
    (typeof config.more_icon !== 'string' || !config.more_icon.trim())
  ) {
    throw new Error(`${cardName}: "more_icon" must be a non-empty icon name`);
  }
}

export function applyAccentColor(element, value, variable = '--terminal-card-accent') {
  const color = normalizeAccentColor(value);
  if (color) element.style.setProperty(variable, color);
  else element.style.removeProperty(variable);
  return color;
}

export function appearanceSchema({ titlePosition = false, moreIcon = false } = {}) {
  const schema = [
    { name: 'accent_color', selector: { color_rgb: {} } },
  ];
  if (titlePosition) {
    schema.push({
      name: 'title_position',
      default: 'left',
      selector: {
        select: {
          mode: 'dropdown',
          options: [
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ],
        },
      },
    });
  }
  if (moreIcon) {
    schema.push({ name: 'more_icon', selector: { icon: {} } });
  }
  return schema;
}
