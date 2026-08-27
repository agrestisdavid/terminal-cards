export const COLOR_MODES = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function lightTemperatureBounds(attributes = {}) {
  const min = Number(attributes.min_color_temp_kelvin) ||
    (Number(attributes.max_mireds)
      ? Math.round(1000000 / Number(attributes.max_mireds))
      : 2000);
  const max = Number(attributes.max_color_temp_kelvin) ||
    (Number(attributes.min_mireds)
      ? Math.round(1000000 / Number(attributes.min_mireds))
      : 6500);
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

export function lightColorTemperature(attributes = {}, bounds = lightTemperatureBounds(attributes)) {
  const fallback = Math.round((bounds.min + bounds.max) / 2);
  const value = Number(attributes.color_temp_kelvin) ||
    (Number(attributes.color_temp)
      ? Math.round(1000000 / Number(attributes.color_temp))
      : fallback);
  return clamp(value, bounds.min, bounds.max);
}

export function temperatureColor(value, bounds) {
  const range = Math.max(1, bounds.max - bounds.min);
  const progress = clamp((value - bounds.min) / range, 0, 1);
  const warm = [255, 147, 44];
  const cool = [202, 218, 255];
  const color = warm.map((channel, index) =>
    Math.round(channel + (cool[index] - channel) * progress)
  );
  return `rgb(${color.join(' ')})`;
}

export function activeLightColor(entity, enabled) {
  if (!enabled || entity?.state !== 'on') return null;
  const attributes = entity.attributes || {};
  const colorMode = attributes.color_mode;
  if (colorMode === 'color_temp') {
    const bounds = lightTemperatureBounds(attributes);
    return temperatureColor(lightColorTemperature(attributes, bounds), bounds);
  }
  if (COLOR_MODES.has(colorMode)) {
    const rgb = attributes.rgb_color;
    if (Array.isArray(rgb) && rgb.length >= 3) {
      const values = rgb.slice(0, 3).map((value) =>
        Math.round(clamp(value, 0, 255))
      );
      return `rgb(${values.join(' ')})`;
    }
    const hs = attributes.hs_color;
    if (Array.isArray(hs) && hs.length >= 2) {
      return `hsl(${clamp(hs[0], 0, 360)} ${clamp(hs[1], 0, 100)}% 60%)`;
    }
  }
  if (Number(attributes.color_temp_kelvin)) {
    const bounds = lightTemperatureBounds(attributes);
    return temperatureColor(lightColorTemperature(attributes, bounds), bounds);
  }
  return null;
}
