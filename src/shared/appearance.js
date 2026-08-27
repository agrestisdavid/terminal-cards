export const DEFAULT_MORE_ICON = 'mdi:dots-vertical';
export const TITLE_POSITIONS = new Set(['left', 'right']);

// Mirrors Home Assistant frontend's THEME_COLORS palette used by the ui_color selector.
const HA_THEME_COLOR_FALLBACKS = Object.freeze({
  primary: '#03a9f4',
  accent: '#89b4fa',
  red: '#f44336',
  pink: '#e91e63',
  purple: '#9c27b0',
  'deep-purple': '#673ab7',
  indigo: '#3f51b5',
  blue: '#2196f3',
  'light-blue': '#03a9f4',
  cyan: '#00bcd4',
  teal: '#009688',
  green: '#4caf50',
  'light-green': '#8bc34a',
  lime: '#cddc39',
  yellow: '#ffeb3b',
  amber: '#ffc107',
  orange: '#ff9800',
  'deep-orange': '#ff5722',
  brown: '#795548',
  'light-grey': '#bdbdbd',
  grey: '#9e9e9e',
  'dark-grey': '#606060',
  'blue-grey': '#607d8b',
  black: '#000000',
  white: '#ffffff',
});

export const HA_THEME_COLORS = new Set(Object.keys(HA_THEME_COLOR_FALLBACKS));

export function normalizeAccentColor(value) {
  if (typeof value === 'string' && HA_THEME_COLORS.has(value)) {
    return `var(--${value}-color, ${HA_THEME_COLOR_FALLBACKS[value]})`;
  }
  if (!Array.isArray(value) || value.length !== 3) return null;
  const channels = value.slice(0, 3).map(Number);
  if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) {
    return null;
  }
  return `rgb(${channels.map(Math.round).join(' ')})`;
}

export function validateAppearance(
  config,
  cardName,
  { titlePosition = false, popupTitle = false, borderTitle = false } = {}
) {
  if (config.accent_color !== undefined && normalizeAccentColor(config.accent_color) === null) {
    throw new Error(`${cardName}: "accent_color" must be a Home Assistant theme color`);
  }
  if (
    titlePosition &&
    config.title_position !== undefined &&
    !TITLE_POSITIONS.has(config.title_position)
  ) {
    throw new Error(`${cardName}: "title_position" must be left or right`);
  }
  for (const iconKey of ['more_icon', 'off_icon']) {
    if (
      config[iconKey] !== undefined &&
      (typeof config[iconKey] !== 'string' || !config[iconKey].trim())
    ) {
      throw new Error(`${cardName}: "${iconKey}" must be a non-empty icon name`);
    }
  }
  if (
    borderTitle &&
    config.border_title !== undefined &&
    (typeof config.border_title !== 'string' || !config.border_title.trim())
  ) {
    throw new Error(`${cardName}: "border_title" must be a non-empty title`);
  }
  if (
    popupTitle &&
    config.popup_title !== undefined &&
    (typeof config.popup_title !== 'string' || !config.popup_title.trim())
  ) {
    throw new Error(`${cardName}: "popup_title" must be a non-empty title`);
  }
}

export function applyAccentColor(element, value, variable = '--terminal-card-accent') {
  const color = normalizeAccentColor(value);
  if (color) element.style.setProperty(variable, color);
  else element.style.removeProperty(variable);
  return color;
}

export function appearanceSchema(
  {
    titlePosition = false,
    moreIcon = false,
    popupTitle = false,
    borderTitle = false,
  } = {}
) {
  const schema = [
    {
      name: 'accent_color',
      selector: { ui_color: { default_color: 'accent' } },
    },
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
  if (borderTitle) {
    schema.push({ name: 'border_title', selector: { text: {} } });
  }
  if (popupTitle) {
    schema.push({ name: 'popup_title', selector: { text: {} } });
  }
  return schema;
}
