import { normalizeAccentColor } from './appearance.js';

export const WASTE_TYPES = Object.freeze([
  Object.freeze({
    key: 'plastic',
    colorKey: 'plastic_color',
    label: 'Plastic / yellow bag color',
    defaultColor: 'yellow',
    keywords: Object.freeze([
      'gelber sack', 'gelbe tonne', 'leichtverpack', 'kunststoff',
      'plastic', 'packaging', 'yellow bag', 'yellow bin',
    ]),
  }),
  Object.freeze({
    key: 'paper',
    colorKey: 'paper_color',
    label: 'Paper color',
    defaultColor: 'blue',
    keywords: Object.freeze([
      'papier', 'karton', 'paper', 'cardboard', 'blaue tonne', 'blue bin',
    ]),
  }),
  Object.freeze({
    key: 'bio',
    colorKey: 'bio_color',
    label: 'Organic waste color',
    defaultColor: 'green',
    keywords: Object.freeze([
      'biomull', 'bioabfall', 'bioabfuhr', 'biotonne', 'braune tonne',
      'bio', 'organic', 'compost', 'green waste',
    ]),
  }),
  Object.freeze({
    key: 'residual',
    colorKey: 'residual_color',
    label: 'Residual waste color',
    defaultColor: 'grey',
    keywords: Object.freeze([
      'restmull', 'restabfall', 'graue tonne', 'schwarze tonne',
      'residual', 'general waste', 'black bin', 'grey bin',
    ]),
  }),
  Object.freeze({
    key: 'glass',
    colorKey: 'glass_color',
    label: 'Glass color',
    defaultColor: 'cyan',
    keywords: Object.freeze(['altglas', 'glas', 'glass']),
  }),
  Object.freeze({
    key: 'other',
    colorKey: 'other_color',
    label: 'Other waste color',
    defaultColor: 'accent',
    keywords: Object.freeze([]),
  }),
]);

function normalizeWasteText(value) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function wasteTypeForSummary(summary) {
  const normalized = normalizeWasteText(summary);
  return WASTE_TYPES.find(({ key, keywords }) => (
    key !== 'other' && keywords.some((keyword) => normalized.includes(keyword))
  )) || WASTE_TYPES[WASTE_TYPES.length - 1];
}

export function wasteColorSchema() {
  return WASTE_TYPES.map(({ colorKey, defaultColor }) => ({
    name: colorKey,
    selector: { ui_color: { default_color: defaultColor } },
  }));
}

export function validateWasteColors(config, cardName) {
  for (const { colorKey } of WASTE_TYPES) {
    if (config?.[colorKey] !== undefined && normalizeAccentColor(config[colorKey]) === null) {
      throw new Error(`${cardName}: "${colorKey}" must be a Home Assistant theme color`);
    }
  }
}

export function wasteColorForSummary(summary, config) {
  const type = wasteTypeForSummary(summary);
  const color = normalizeAccentColor(
    config?.[type.colorKey] ?? config?.accent_color ?? type.defaultColor
  );
  return { type: type.key, color };
}
