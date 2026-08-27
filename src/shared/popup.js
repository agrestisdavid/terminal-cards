import { applyAccentColor } from './appearance.js';
import {
  activeLightColor,
  COLOR_MODES,
  lightColorTemperature,
  lightTemperatureBounds,
} from './light-color.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from './styles.js';

const TAG = 'terminal-entity-popup';
const SUPPORT_OPEN = 1;
const SUPPORT_CLOSE = 2;
const SUPPORT_SET_POSITION = 4;
const SUPPORT_STOP = 8;
const SUPPORT_SET_TILT_POSITION = 64;

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: grid;
    place-items: center;
    padding: 16px;
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
    font-size: 13px;
  }
  :host([hidden]) { display: none; }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 62%);
  }
  .dialog {
    --terminal-popup-effective-accent: var(
      --terminal-popup-light-color,
      var(--terminal-accent)
    );
    position: relative;
    box-sizing: border-box;
    width: min(480px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    margin-top: 8px;
    border: 1px solid var(--terminal-popup-effective-accent);
    border-radius: 0;
    background: var(--terminal-background);
    box-shadow: 0 0 18px color-mix(
      in srgb,
      var(--terminal-popup-effective-accent) 38%,
      transparent
    );
    overflow: auto;
    outline: none;
  }
  .border-title {
    position: absolute;
    top: 0;
    left: 12px;
    box-sizing: border-box;
    transform: translateY(-50%);
    max-width: calc(100% - 72px);
    padding: 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--terminal-background);
    color: var(--terminal-popup-effective-accent);
    font: 600 12px/1.4 ${TERMINAL_FONT};
  }
  .header {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 82px;
    padding: 18px 14px 10px;
  }
  .entity-icon {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    color: var(--terminal-popup-effective-accent);
    --mdc-icon-size: 34px;
  }
  .header-text { flex: 1 1 auto; min-width: 0; }
  .name, .state {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name { font-weight: 600; }
  .state { color: var(--terminal-dim); font-size: 12px; }
  .close, .action {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    font: 12px ${TERMINAL_FONT};
    cursor: pointer;
  }
  .close { flex: 0 0 36px; width: 36px; padding: 0; }
  .close:hover, .close:focus-visible,
  .action:hover, .action:focus-visible {
    border-color: var(--terminal-popup-effective-accent);
    color: var(--terminal-popup-effective-accent);
    outline: none;
  }
  .close ha-icon, .action ha-icon {
    width: 19px;
    height: 19px;
    --mdc-icon-size: 19px;
  }
  .body {
    display: grid;
    gap: 16px;
    padding: 4px 14px 14px;
  }
  .section { display: grid; gap: 8px; }
  .section-title {
    color: var(--terminal-popup-effective-accent);
    font-size: 11px;
    font-weight: 600;
  }
  .details {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 6px 14px;
    min-width: 0;
  }
  .detail-label { color: var(--terminal-dim); }
  .detail-value {
    min-width: 0;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(var(--terminal-popup-action-count, 1), minmax(0, 1fr));
    gap: 8px;
  }
  .action { width: 100%; gap: 7px; }
  .action:disabled { cursor: not-allowed; opacity: .45; }
  .range {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 46px;
    align-items: center;
    gap: 8px;
  }
  .range-label, .range-value { color: var(--terminal-dim); font-size: 11px; }
  .range-value { text-align: right; }
  input[type="range"] {
    width: 100%;
    margin: 0;
    accent-color: var(--terminal-popup-effective-accent);
    cursor: pointer;
  }
  input[type="range"]:focus-visible {
    outline: 1px solid var(--terminal-popup-effective-accent);
    outline-offset: 3px;
  }
  @media (max-width: 420px) {
    :host { padding: 8px; }
    .dialog { width: calc(100vw - 16px); max-height: calc(100vh - 16px); }
  }
`;

function iconElement(icon) {
  const element = document.createElement('ha-icon');
  element.icon = icon;
  return element;
}

function percentage(value, maximum = 100) {
  return Math.max(0, Math.min(maximum, Math.round(Number(value) || 0)));
}

export class TerminalEntityPopup extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._entityId = null;
    this._trigger = null;
    this._returnFocus = null;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'backdrop';
    this._dialog = document.createElement('section');
    this._dialog.className = 'dialog';
    this._dialog.setAttribute('role', 'dialog');
    this._dialog.setAttribute('aria-modal', 'true');
    this._dialog.tabIndex = -1;
    this._borderTitle = document.createElement('div');
    this._borderTitle.className = 'border-title';
    this._header = document.createElement('div');
    this._header.className = 'header';
    this._entityIcon = iconElement('mdi:information-outline');
    this._entityIcon.className = 'entity-icon';
    this._headerText = document.createElement('div');
    this._headerText.className = 'header-text';
    this._name = document.createElement('div');
    this._name.className = 'name';
    this._state = document.createElement('div');
    this._state.className = 'state';
    this._headerText.append(this._name, this._state);
    this._close = document.createElement('button');
    this._close.className = 'close';
    this._close.type = 'button';
    this._close.title = 'close';
    this._close.setAttribute('aria-label', 'close terminal details');
    this._close.append(iconElement('mdi:close'));
    this._header.append(this._entityIcon, this._headerText, this._close);
    this._body = document.createElement('div');
    this._body.className = 'body';
    this._dialog.append(this._borderTitle, this._header, this._body);
    root.append(style, this._backdrop, this._dialog);

    this._close.addEventListener('click', () => this.close());
    this._backdrop.addEventListener('click', () => this.close());
    this.addEventListener('keydown', (event) => this._handleKeydown(event));
  }

  show(trigger, hass, config) {
    this._trigger = trigger;
    this._returnFocus = trigger?.shadowRoot?.activeElement || trigger;
    this._hass = hass;
    this._config = { ...config };
    this._entityId = config.entity;
    this._render();
    this.hidden = false;
    requestAnimationFrame(() => {
      if (!this.hidden) this._close.focus();
    });
  }

  updateHass(hass) {
    this._hass = hass;
    if (!this.hidden) this._render();
  }

  close(trigger = null) {
    if (trigger && trigger !== this._trigger) return;
    if (this.hidden) return;
    this.hidden = true;
    const focusTarget = this._returnFocus;
    this._hass = null;
    this._config = null;
    this._entityId = null;
    this._trigger = null;
    this._returnFocus = null;
    this._body.replaceChildren();
    if (focusTarget?.isConnected && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
  }

  _entity() {
    return this._hass?.states?.[this._entityId] || null;
  }

  _render() {
    const entity = this._entity();
    const attributes = entity?.attributes || {};
    const domain = this._entityId?.split('.', 1)[0] || '';
    const unavailable = !entity || ['unavailable', 'unknown'].includes(entity.state);
    applyAccentColor(this, this._config?.accent_color);
    const lightColor = domain === 'light'
      ? activeLightColor(entity, this._config?.use_light_color === true)
      : null;
    if (lightColor) this.style.setProperty('--terminal-popup-light-color', lightColor);
    else this.style.removeProperty('--terminal-popup-light-color');

    const name = this._config?.name || attributes.friendly_name || this._entityId || 'entity';
    const formattedState = entity
      ? this._hass?.formatEntityState?.(entity) || entity.state
      : 'unavailable';
    this._dialog.setAttribute('aria-label', `${name} details`);
    this._borderTitle.textContent = 'entity details';
    this._entityIcon.icon = this._config?.icon || attributes.icon || this._defaultIcon(domain);
    this._name.textContent = name;
    this._state.textContent = String(formattedState).toLocaleLowerCase();
    this._body.replaceChildren();
    this._body.append(this._detailsSection(entity, attributes, domain));

    const controls = domain === 'light'
      ? this._lightControls(entity, attributes, unavailable)
      : domain === 'cover'
        ? this._coverControls(attributes, unavailable)
        : null;
    if (controls) this._body.append(controls);
  }

  _defaultIcon(domain) {
    if (domain === 'light') return 'mdi:lightbulb';
    if (domain === 'cover') return 'mdi:blinds-horizontal';
    return 'mdi:information-outline';
  }

  _section(title) {
    const section = document.createElement('section');
    section.className = 'section';
    const heading = document.createElement('div');
    heading.className = 'section-title';
    heading.textContent = title;
    section.append(heading);
    return section;
  }

  _detailsSection(entity, attributes, domain) {
    const section = this._section('status');
    const details = document.createElement('div');
    details.className = 'details';
    const add = (label, value) => {
      const labelElement = document.createElement('span');
      labelElement.className = 'detail-label';
      labelElement.textContent = label;
      const valueElement = document.createElement('span');
      valueElement.className = 'detail-value';
      valueElement.textContent = String(value);
      details.append(labelElement, valueElement);
    };
    add('entity', this._entityId || 'unavailable');
    add('state', entity?.state || 'unavailable');
    if (domain === 'light' && attributes.brightness !== undefined) {
      add('brightness', `${entity?.state === 'on' ? percentage((Number(attributes.brightness) / 255) * 100) : 0}%`);
    }
    if (domain === 'light' && Number(attributes.color_temp_kelvin)) {
      add('temperature', `${Math.round(Number(attributes.color_temp_kelvin))}K`);
    }
    if (domain === 'cover' && attributes.current_position !== undefined) {
      add('position', `${percentage(attributes.current_position)}%`);
    }
    if (domain === 'cover' && attributes.current_tilt_position !== undefined) {
      add('tilt', `${percentage(attributes.current_tilt_position)}%`);
    }
    section.append(details);
    return section;
  }

  _actionButton(label, icon, callback, disabled = false) {
    const button = document.createElement('button');
    button.className = 'action';
    button.type = 'button';
    button.disabled = disabled;
    button.append(iconElement(icon), document.createTextNode(label));
    button.addEventListener('click', callback);
    return button;
  }

  _actions(buttons) {
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.style.setProperty('--terminal-popup-action-count', String(Math.max(1, buttons.length)));
    actions.append(...buttons);
    return actions;
  }

  _range(label, value, min, max, step, callback, disabled = false, suffix = '%') {
    const row = document.createElement('label');
    row.className = 'range';
    const labelElement = document.createElement('span');
    labelElement.className = 'range-label';
    labelElement.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.disabled = disabled;
    input.setAttribute('aria-label', label);
    const valueElement = document.createElement('span');
    valueElement.className = 'range-value';
    valueElement.textContent = `${value}${suffix}`;
    input.addEventListener('input', () => {
      valueElement.textContent = `${input.value}${suffix}`;
    });
    input.addEventListener('change', () => callback(Number(input.value)));
    row.append(labelElement, input, valueElement);
    return row;
  }

  _lightControls(entity, attributes, unavailable) {
    const modes = attributes.supported_color_modes || [];
    const supportsBrightness = attributes.brightness !== undefined ||
      modes.some((mode) => mode !== 'onoff');
    const supportsHue = modes.some((mode) => COLOR_MODES.has(mode));
    const supportsTemperature = modes.includes('color_temp');
    const section = this._section('controls');
    const toggleOn = entity?.state !== 'on';
    section.append(this._actions([
      this._actionButton(
        toggleOn ? 'turn on' : 'turn off',
        toggleOn ? 'mdi:lightbulb-on-outline' : 'mdi:lightbulb-off-outline',
        () => this._callService('light', 'toggle'),
        unavailable
      ),
    ]));
    if (supportsBrightness) {
      const brightness = entity?.state === 'on'
        ? percentage((Number(attributes.brightness) / 255) * 100)
        : 0;
      section.append(this._range('bri', brightness, 0, 100, 1, (value) => {
        this._callService(
          'light',
          value === 0 ? 'turn_off' : 'turn_on',
          value === 0 ? {} : { brightness_pct: value }
        );
      }, unavailable));
    }
    if (supportsHue) {
      const hue = percentage(attributes.hs_color?.[0], 360);
      section.append(this._range('hue', hue, 0, 360, 1, (value) => {
        const saturation = percentage(attributes.hs_color?.[1] || 100);
        this._callService('light', 'turn_on', { hs_color: [value, saturation] });
      }, unavailable, '°'));
    }
    if (supportsTemperature) {
      const bounds = lightTemperatureBounds(attributes);
      const temperature = lightColorTemperature(attributes, bounds);
      section.append(this._range(
        'temp',
        temperature,
        bounds.min,
        bounds.max,
        50,
        (value) => this._callService('light', 'turn_on', { color_temp_kelvin: value }),
        unavailable,
        'K'
      ));
    }
    return section;
  }

  _coverControls(attributes, unavailable) {
    const features = Number(attributes.supported_features) || 0;
    const supports = (feature) => (features & feature) !== 0;
    const section = this._section('controls');
    const commandButtons = [];
    if (supports(SUPPORT_OPEN)) {
      commandButtons.push(this._actionButton(
        'open',
        'mdi:arrow-up',
        () => this._callService('cover', 'open_cover'),
        unavailable
      ));
    }
    if (supports(SUPPORT_STOP)) {
      commandButtons.push(this._actionButton(
        'stop',
        'mdi:stop',
        () => this._callService('cover', 'stop_cover'),
        unavailable
      ));
    }
    if (supports(SUPPORT_CLOSE)) {
      commandButtons.push(this._actionButton(
        'close',
        'mdi:arrow-down',
        () => this._callService('cover', 'close_cover'),
        unavailable
      ));
    }
    if (commandButtons.length) section.append(this._actions(commandButtons));
    if (supports(SUPPORT_SET_POSITION)) {
      section.append(this._range(
        'pos',
        percentage(attributes.current_position),
        0,
        100,
        1,
        (value) => this._callService('cover', 'set_cover_position', { position: value }),
        unavailable
      ));
    }
    if (supports(SUPPORT_SET_TILT_POSITION)) {
      section.append(this._range(
        'tilt',
        percentage(attributes.current_tilt_position),
        0,
        100,
        1,
        (value) => this._callService(
          'cover',
          'set_cover_tilt_position',
          { tilt_position: value }
        ),
        unavailable
      ));
    }
    return section;
  }

  _callService(domain, service, data = {}) {
    if (!this._hass || !this._entityId) return;
    this._hass.callService(domain, service, data, { entity_id: this._entityId });
  }

  _handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...this.shadowRoot.querySelectorAll('button, input')]
      .filter((element) => !element.disabled && !element.closest('[hidden]'));
    if (!focusable.length) {
      event.preventDefault();
      this._dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && this.shadowRoot.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.shadowRoot.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, TerminalEntityPopup);

let popup = null;

function popupElement() {
  if (!popup?.isConnected) {
    popup = document.createElement(TAG);
    document.body.append(popup);
    popup.hidden = true;
  }
  return popup;
}

export function showTerminalEntityPopup(trigger, hass, config) {
  if (!config?.entity) return;
  popupElement().show(trigger, hass, config);
}

export function updateTerminalEntityPopup(hass) {
  popup?.updateHass(hass);
}

export function closeTerminalEntityPopup(trigger) {
  popup?.close(trigger);
}
