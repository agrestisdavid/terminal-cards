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
