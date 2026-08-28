import { normalizeAccentColor } from './appearance.js';

export const ALARM_MODES = Object.freeze([
  Object.freeze({
    feature: 1,
    label: 'home',
    popupLabel: 'arm home',
    icon: 'mdi:shield-home-outline',
    service: 'alarm_arm_home',
    targetState: 'armed_home',
  }),
  Object.freeze({
    feature: 2,
    label: 'away',
    popupLabel: 'arm away',
    icon: 'mdi:shield-lock-outline',
    service: 'alarm_arm_away',
    targetState: 'armed_away',
  }),
  Object.freeze({
    feature: 4,
    label: 'night',
    popupLabel: 'arm night',
    icon: 'mdi:shield-moon-outline',
    service: 'alarm_arm_night',
    targetState: 'armed_night',
  }),
  Object.freeze({
    feature: 32,
    label: 'vacation',
    popupLabel: 'vacation',
    icon: 'mdi:shield-airplane-outline',
    service: 'alarm_arm_vacation',
    targetState: 'armed_vacation',
  }),
  Object.freeze({
    feature: 16,
    label: 'custom',
    popupLabel: 'custom',
    icon: 'mdi:shield-half-full',
    service: 'alarm_arm_custom_bypass',
    targetState: 'armed_custom_bypass',
  }),
]);

export const ALARM_TRANSITION_STATES = new Set(['triggered', 'arming', 'pending']);

export const ALARM_COLOR_OPTIONS = Object.freeze([
  Object.freeze({
    key: 'disarmed_color',
    label: 'Disarmed color',
    state: 'disarmed',
    defaultColor: 'grey',
  }),
  Object.freeze({
    key: 'home_color',
    label: 'Home color',
    state: 'armed_home',
    defaultColor: 'blue',
  }),
  Object.freeze({
    key: 'away_color',
    label: 'Away color',
    state: 'armed_away',
    defaultColor: 'orange',
  }),
  Object.freeze({
    key: 'night_color',
    label: 'Night color',
    state: 'armed_night',
    defaultColor: 'purple',
  }),
  Object.freeze({
    key: 'vacation_color',
    label: 'Vacation color',
    state: 'armed_vacation',
    defaultColor: 'cyan',
  }),
  Object.freeze({
    key: 'custom_bypass_color',
    label: 'Custom Bypass color',
    state: 'armed_custom_bypass',
    defaultColor: 'pink',
  }),
  Object.freeze({
    key: 'arming_color',
    label: 'Arming color',
    state: 'arming',
    defaultColor: 'yellow',
  }),
  Object.freeze({
    key: 'pending_color',
    label: 'Pending color',
    state: 'pending',
    defaultColor: 'deep-orange',
  }),
  Object.freeze({
    key: 'disarming_color',
    label: 'Disarming color',
    state: 'disarming',
    defaultColor: 'yellow',
  }),
  Object.freeze({
    key: 'triggered_color',
    label: 'Triggered color',
    state: 'triggered',
    defaultColor: 'red',
  }),
]);

const ALARM_COLOR_BY_STATE = new Map(
  ALARM_COLOR_OPTIONS.map((option) => [option.state, option])
);

export function alarmColorSchema() {
  return ALARM_COLOR_OPTIONS.map(({ key, defaultColor }) => ({
    name: key,
    selector: { ui_color: { default_color: defaultColor } },
  }));
}

export function validateAlarmColors(config, cardName) {
  for (const { key } of ALARM_COLOR_OPTIONS) {
    if (config?.[key] !== undefined && normalizeAccentColor(config[key]) === null) {
      throw new Error(`${cardName}: "${key}" must be a Home Assistant theme color`);
    }
  }
}

export function applyAlarmStateColor(
  element,
  state,
  config,
  variable = '--terminal-alarm-state-color'
) {
  const option = ALARM_COLOR_BY_STATE.get(state);
  const unavailable = !state || state === 'unavailable' || state === 'unknown';
  const color = unavailable
    ? 'var(--terminal-error)'
    : option
      ? normalizeAccentColor(
        config?.[option.key] ?? config?.accent_color ?? option.defaultColor
      )
      : normalizeAccentColor(config?.accent_color);
  if (color) element.style.setProperty(variable, color);
  else element.style.removeProperty(variable);
  return color;
}

export function alarmDefaultCode(hass, entityId) {
  const options = hass?.entities?.[entityId]?.options;
  const code = options?.default_code ?? options?.alarm_control_panel?.default_code;
  return code === undefined || code === null ? '' : String(code);
}

export function alarmControlModel(entity, hass, entityId) {
  const attributes = entity?.attributes || {};
  const state = entity?.state || 'unavailable';
  const features = Number(attributes.supported_features) || 0;
  const defaultCode = alarmDefaultCode(hass, entityId);
  const hasDefaultCode = Boolean(defaultCode);
  const codeFormat = attributes.code_format;
  const canDisarm = state !== 'disarmed' && state !== 'disarming';
  const canArm = !ALARM_TRANSITION_STATES.has(state) && state !== 'disarming';
  const needsArmCode = Boolean(codeFormat && attributes.code_arm_required !== false);
  const needsDisarmCode = Boolean(codeFormat);
  const showCode = !hasDefaultCode && (
    (canDisarm && needsDisarmCode) || (canArm && needsArmCode)
  );
  const modes = canArm
    ? ALARM_MODES.filter(({ feature }) => (features & feature) !== 0)
    : [];

  return {
    state,
    defaultCode,
    hasDefaultCode,
    codeFormat,
    canDisarm,
    canArm,
    needsArmCode,
    needsDisarmCode,
    showCode,
    modes,
  };
}

export function sanitizeAlarmCode(value, codeFormat) {
  const code = String(value ?? '');
  return codeFormat === 'number' ? code.replace(/\D/g, '') : code;
}
