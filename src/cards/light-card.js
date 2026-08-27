import {
  DOCUMENTATION_URL,
  defineElement,
  executeAction,
  registerCard,
} from '../shared/ha.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';

const TAG = 'terminal-light-card';
const DEFAULT_TAP_ACTION = { action: 'toggle' };
const DEFAULT_HOLD_ACTION = { action: 'more-info' };
const COLOR_MODES = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);
const SEGMENT_SIZE = 7;
const MIN_SEGMENT_GAP = 4;
const MAX_SEGMENTS = 40;

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    display: block;
    height: 100%;
  }
  .card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 72px;
    height: 100%;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .card[data-state="on"] { border-color: var(--terminal-accent); }
  .card[data-state="unavailable"] { border-color: var(--terminal-error); }
  .card[data-light-color="true"] { border-color: var(--terminal-light-color); }
  .card[data-state="on"][data-light-color="true"] .icon { color: var(--terminal-light-color); }
  .card:not([data-state="unavailable"]):hover {
    border-color: var(--terminal-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--terminal-accent) 45%, transparent);
  }
  .card[data-light-color="true"]:hover {
    border-color: var(--terminal-light-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--terminal-light-color) 45%, transparent);
  }
  .card:not([data-state="unavailable"]):hover .icon,
  .card:not([data-state="unavailable"]):hover .name { color: var(--terminal-accent); }
  .card[data-light-color="true"]:hover .icon { color: var(--terminal-light-color); }
  .main {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 72px;
    padding: 12px 14px;
    cursor: pointer;
    outline: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .main:focus-visible { outline: 1px solid var(--terminal-accent); outline-offset: -3px; }
  .icon {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    color: var(--terminal-dim);
    pointer-events: none;
  }
  .card[data-state="on"] .icon { color: var(--terminal-accent); }
  .card[data-state="unavailable"] .icon { color: var(--terminal-error); }
  .text { flex: 1 1 auto; min-width: 0; pointer-events: none; }
  .name, .state {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name { font-weight: 600; }
  .state { color: var(--terminal-dim); font-size: 12px; }
  .card[data-state="unavailable"] .state { color: var(--terminal-error); }
  .more {
    box-sizing: border-box;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    line-height: 0;
    cursor: pointer;
  }
  .more[hidden] { display: none; }
  .more:hover, .more:focus-visible, .more[aria-expanded="true"] {
    border-color: currentColor;
    color: var(--terminal-accent);
    outline: none;
  }
  .more ha-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    --mdc-icon-size: 20px;
  }
  .controls {
    display: grid;
    gap: 8px;
    margin-top: auto;
    padding: 0 14px 12px;
  }
  .controls[hidden], .control[hidden] { display: none; }
  .control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }
  .control-main {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .control-label, .control-value {
    color: var(--terminal-dim);
    font-size: 11px;
    white-space: nowrap;
  }
  .control-value { text-align: center; }
  .track {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 20px;
  }
  .track:focus-within {
    outline: 1px solid var(--terminal-accent);
    outline-offset: 2px;
  }
  .track[data-disabled="true"] { cursor: not-allowed; opacity: .55; }
  .segments {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-width: 0;
    pointer-events: none;
  }
  .segment {
    box-sizing: border-box;
    flex: 0 0 ${SEGMENT_SIZE}px;
    width: ${SEGMENT_SIZE}px;
    height: ${SEGMENT_SIZE}px;
    border: 0;
    background: var(--terminal-dim);
    opacity: .42;
  }
  .control[data-control="brightness"] .segment[data-active="true"] {
    background: var(--terminal-accent);
    opacity: 1;
  }
  .control:not([data-control="brightness"]) .segment { opacity: .42; }
  .control:not([data-control="brightness"]) .segment[data-selected="true"] {
    border: 1px solid var(--terminal-text);
    opacity: 1;
  }
  input[type="range"] {
    appearance: none;
    -webkit-appearance: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  input[type="range"]:disabled { cursor: not-allowed; }
`;

export class TerminalLightCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      entity: 'Light entity',
      name: 'Name',
      icon: 'Icon',
      show_state: 'Show state',
      show_brightness: 'Show brightness',
      show_hue: 'Show hue',
      show_color_temp: 'Show color temperature',
      use_light_color: 'Use current light color',
      show_controls: 'Show controls button',
      controls_expanded: 'Expand controls by default',
      tap_action: 'Tap action',
      hold_action: 'Hold action',
    };
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { domain: 'light' } } },
        },
        {
          type: 'grid',
          name: '',
          flatten: true,
          schema: [
            { name: 'name', selector: { text: {} } },
            {
              name: 'icon',
              selector: { icon: {} },
              context: { icon_entity: 'entity' },
            },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Display and controls',
          flatten: true,
          schema: [
            { name: 'show_state', default: true, selector: { boolean: {} } },
            { name: 'show_brightness', default: true, selector: { boolean: {} } },
            { name: 'show_hue', default: true, selector: { boolean: {} } },
            { name: 'show_color_temp', default: true, selector: { boolean: {} } },
            { name: 'use_light_color', default: false, selector: { boolean: {} } },
            { name: 'show_controls', default: true, selector: { boolean: {} } },
            { name: 'controls_expanded', default: false, selector: { boolean: {} } },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Actions',
          flatten: true,
          schema: [
            {
              name: 'tap_action',
              selector: {
                ui_action: {
                  actions: ['toggle', 'more-info', 'navigate', 'url', 'perform-action', 'none'],
                  default_action: 'toggle',
                },
              },
            },
            {
              name: 'hold_action',
              selector: {
                ui_action: {
                  actions: ['toggle', 'more-info', 'navigate', 'url', 'perform-action', 'none'],
                  default_action: 'more-info',
                },
              },
            },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) => {
        if (schema.name === 'show_brightness') {
          return 'Shown only when the selected light supports brightness.';
        }
        if (schema.name === 'show_hue') {
          return 'Shown only for color-capable lights.';
        }
        if (schema.name === 'show_color_temp') {
          return 'Shown only for lights that support color temperature.';
        }
        if (schema.name === 'use_light_color') {
          return 'Colors the icon and border from the active RGB/HS color or color temperature.';
        }
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    const candidates = [...entities, ...Object.keys(hass?.states || {})];
    const entity = candidates.find((entityId) => entityId.startsWith('light.')) || '';
    return {
      entity,
      show_state: true,
      show_brightness: true,
      show_hue: true,
      show_color_temp: true,
      use_light_color: false,
      show_controls: true,
      controls_expanded: false,
    };
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._holdTimer = null;
    this._held = false;
    this._controlsExpanded = false;
    this._segmentLayoutFrame = null;
    this._resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this._updateSegmentCounts())
      : null;
    this._controlsByName = {};

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._card = document.createElement('article');
    this._card.className = 'card';
    this._main = document.createElement('div');
    this._main.className = 'main';
    this._main.tabIndex = 0;
    this._main.setAttribute('role', 'button');
    this._icon = document.createElement('ha-icon');
    this._icon.className = 'icon';
    this._text = document.createElement('div');
    this._text.className = 'text';
    this._name = document.createElement('div');
    this._name.className = 'name';
    this._state = document.createElement('div');
    this._state.className = 'state';
    this._text.append(this._name, this._state);
    this._more = document.createElement('button');
    this._more.className = 'more';
    this._more.type = 'button';
    this._more.title = 'Toggle light controls';
    this._more.setAttribute('aria-label', 'Toggle light controls');
    this._more.setAttribute('aria-controls', 'terminal-light-controls');
    const moreIcon = document.createElement('ha-icon');
    moreIcon.icon = 'mdi:dots-vertical';
    this._more.append(moreIcon);
    this._main.append(this._icon, this._text, this._more);

    this._controls = document.createElement('div');
    this._controls.id = 'terminal-light-controls';
    this._controls.className = 'controls';
    this._createControl('brightness', 'bri', 0, 100, 1);
    this._createControl('hue', 'hue', 0, 360, 1);
    this._createControl('temperature', 'temp', 2000, 6500, 50);

    this._card.append(this._main, this._controls);
    root.append(style, this._card);

    this._main.addEventListener('click', () => this._tap());
    this._main.addEventListener('keydown', (event) => {
      if (
        event.target === this._main &&
        (event.key === 'Enter' || event.key === ' ')
      ) {
        event.preventDefault();
        this._tap();
      }
    });
    this._main.addEventListener('pointerdown', () => this._startHold());
    for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
      this._main.addEventListener(eventName, () => this._cancelHold());
    }
    this._more.addEventListener('pointerdown', (event) => event.stopPropagation());
    this._more.addEventListener('click', (event) => {
      event.stopPropagation();
      this._toggleControls();
    });
  }

  connectedCallback() {
    this._resizeObserver?.observe(this._card);
    this._scheduleSegmentLayout();
  }

  disconnectedCallback() {
    this._cancelHold();
    this._resizeObserver?.disconnect();
    if (this._segmentLayoutFrame !== null) {
      cancelAnimationFrame(this._segmentLayoutFrame);
      this._segmentLayoutFrame = null;
    }
    this._hass = null;
  }

  setConfig(config) {
    if (!config?.entity || typeof config.entity !== 'string') {
      throw new Error('terminal-light-card: "entity" is required');
    }
    if (!config.entity.startsWith('light.')) {
      throw new Error('terminal-light-card: "entity" must be a light');
    }
    const previousDefault = this._config?.controls_expanded;
    this._config = { ...config };
    if (previousDefault !== config.controls_expanded) {
      this._controlsExpanded = config.controls_expanded === true;
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    if (!this._controlsExpanded) return 1;
    return 1 + Math.ceil(this._enabledControlNames().length / 2);
  }

  getGridOptions() {
    return { columns: 6, rows: 'auto', min_columns: 3 };
  }

  _createControl(name, label, min, max, step) {
    const row = document.createElement('div');
    row.className = 'control';
    row.dataset.control = name;
    const main = document.createElement('div');
    main.className = 'control-main';
    const labelElement = document.createElement('span');
    labelElement.className = 'control-label';
    labelElement.textContent = label;
    const track = document.createElement('div');
    track.className = 'track';
    const segments = document.createElement('div');
    segments.className = 'segments';
    segments.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute('aria-label', label);
    track.append(segments, input);
    main.append(labelElement, track);
    const value = document.createElement('span');
    value.className = 'control-value';
    row.append(main, value);
    this._controls.append(row);

    const control = {
      name,
      row,
      track,
      segments,
      segmentElements: [],
      input,
      value,
      min,
      max,
      currentValue: min,
    };
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('input', () => {
      this._renderControl(control, Number(input.value));
    });
    input.addEventListener('change', () => this._setControl(control));
    this._controlsByName[name] = control;
  }

  _entity() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _dataState() {
    const entity = this._entity();
    if (!entity || entity.state === 'unavailable' || entity.state === 'unknown') {
      return 'unavailable';
    }
    return entity.state === 'on' ? 'on' : 'off';
  }

  _supportedModes() {
    return this._entity()?.attributes?.supported_color_modes || [];
  }

  _supportsBrightness() {
    const entity = this._entity();
    const modes = this._supportedModes();
    return entity?.attributes?.brightness !== undefined || modes.some((mode) => mode !== 'onoff');
  }

  _supportsHue() {
    return this._supportedModes().some((mode) => COLOR_MODES.has(mode));
  }

  _supportsColorTemperature() {
    return this._supportedModes().includes('color_temp');
  }

  _enabledControlNames() {
    if (!this._config) return [];
    const names = [];
    if (this._config.show_brightness !== false && this._supportsBrightness()) {
      names.push('brightness');
    }
    if (this._config.show_hue !== false && this._supportsHue()) {
      names.push('hue');
    }
    if (this._config.show_color_temp !== false && this._supportsColorTemperature()) {
      names.push('temperature');
    }
    return names;
  }

  _temperatureBounds(attributes) {
    const min = Number(attributes.min_color_temp_kelvin) ||
      (Number(attributes.max_mireds) ? Math.round(1000000 / Number(attributes.max_mireds)) : 2000);
    const max = Number(attributes.max_color_temp_kelvin) ||
      (Number(attributes.min_mireds) ? Math.round(1000000 / Number(attributes.min_mireds)) : 6500);
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  _lightColor(attributes, state, temperatureBounds, colorTemperature) {
    if (this._config?.use_light_color !== true || state !== 'on') return null;
    const colorMode = attributes.color_mode;
    if (colorMode === 'color_temp') {
      return this._temperatureColor(colorTemperature, temperatureBounds);
    }
    if (COLOR_MODES.has(colorMode)) {
      const rgb = attributes.rgb_color;
      if (Array.isArray(rgb) && rgb.length >= 3) {
        const values = rgb.slice(0, 3).map((value) =>
          Math.max(0, Math.min(255, Math.round(Number(value) || 0)))
        );
        return `rgb(${values.join(' ')})`;
      }
      const hs = attributes.hs_color;
      if (Array.isArray(hs) && hs.length >= 2) {
        const hue = Math.max(0, Math.min(360, Number(hs[0]) || 0));
        const saturation = Math.max(0, Math.min(100, Number(hs[1]) || 0));
        return `hsl(${hue} ${saturation}% 60%)`;
      }
    }
    if (this._supportsColorTemperature() && Number(attributes.color_temp_kelvin)) {
      return this._temperatureColor(colorTemperature, temperatureBounds);
    }
    return null;
  }

  _temperatureColor(value, bounds) {
    const range = Math.max(1, bounds.max - bounds.min);
    const progress = Math.max(0, Math.min(1, (value - bounds.min) / range));
    const warm = [255, 147, 44];
    const cool = [202, 218, 255];
    const color = warm.map((channel, index) =>
      Math.round(channel + (cool[index] - channel) * progress)
    );
    return `rgb(${color.join(' ')})`;
  }

  _render() {
    if (!this._config) return;
    const entity = this._entity();
    const state = this._dataState();
    const unavailable = state === 'unavailable';
    const attributes = entity?.attributes || {};
    const rawBrightness = Math.round(((Number(attributes.brightness) || 0) / 255) * 100);
    const brightness = state === 'on'
      ? Math.max(1, Math.min(100, rawBrightness))
      : 0;
    const hue = Math.max(0, Math.min(360, Number(attributes.hs_color?.[0]) || 0));
    const temperatureBounds = this._temperatureBounds(attributes);
    const colorTemperature = Math.max(
      temperatureBounds.min,
      Math.min(
        temperatureBounds.max,
        Number(attributes.color_temp_kelvin) ||
          (Number(attributes.color_temp)
            ? Math.round(1000000 / Number(attributes.color_temp))
            : Math.round((temperatureBounds.min + temperatureBounds.max) / 2))
      )
    );

    const lightColor = this._lightColor(
      attributes,
      state,
      temperatureBounds,
      colorTemperature
    );
    this._card.dataset.state = state;
    this._card.dataset.lightColor = lightColor ? 'true' : 'false';
    if (lightColor) this._card.style.setProperty('--terminal-light-color', lightColor);
    else this._card.style.removeProperty('--terminal-light-color');
    this._card.setAttribute(
      'aria-label',
      this._config.name || attributes.friendly_name || this._config.entity
    );
    this._icon.icon = this._config.icon || attributes.icon || 'mdi:lightbulb';
    this._name.textContent = this._config.name || attributes.friendly_name || this._config.entity;
    this._state.hidden = this._config.show_state === false;
    const formattedState = entity
      ? this._hass?.formatEntityState?.(entity) || entity.state
      : 'unavailable';
    this._state.textContent = String(formattedState).toLocaleLowerCase();

    const enabledControls = this._enabledControlNames();
    for (const [name, control] of Object.entries(this._controlsByName)) {
      control.row.hidden = !enabledControls.includes(name);
      control.input.disabled = unavailable;
      control.track.dataset.disabled = unavailable ? 'true' : 'false';
    }
    const showControlsButton = this._config.show_controls === undefined
      ? this._config.show_more_info !== false
      : this._config.show_controls !== false;
    this._more.hidden = !showControlsButton || enabledControls.length === 0;
    const expanded = this._controlsExpanded && enabledControls.length > 0;
    this._more.setAttribute('aria-expanded', String(expanded));
    this._controls.hidden = !expanded;

    const brightnessControl = this._controlsByName.brightness;
    brightnessControl.min = 0;
    brightnessControl.max = 100;
    brightnessControl.input.min = '0';
    brightnessControl.input.max = '100';
    this._renderControl(brightnessControl, brightness);

    const hueControl = this._controlsByName.hue;
    hueControl.min = 0;
    hueControl.max = 360;
    this._renderControl(hueControl, hue);

    const temperatureControl = this._controlsByName.temperature;
    temperatureControl.min = temperatureBounds.min;
    temperatureControl.max = temperatureBounds.max;
    temperatureControl.input.min = String(temperatureBounds.min);
    temperatureControl.input.max = String(temperatureBounds.max);
    this._renderControl(temperatureControl, colorTemperature);

    this._main.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
    if (expanded) {
      this._updateSegmentCounts();
      this._scheduleSegmentLayout();
    }
  }

  _renderControl(control, value) {
    const normalized = Math.max(
      control.min,
      Math.min(control.max, Math.round(Number(value) || control.min))
    );
    control.currentValue = normalized;
    control.input.value = String(normalized);
    if (control.name === 'brightness') control.value.textContent = `${normalized}%`;
    if (control.name === 'hue') control.value.textContent = `${normalized}°`;
    if (control.name === 'temperature') control.value.textContent = `${normalized}K`;
    this._paintSegments(control);
  }

  _paintSegments(control) {
    const count = control.segmentElements.length;
    if (!count) return;
    const range = Math.max(1, control.max - control.min);
    const ratio = (control.currentValue - control.min) / range;
    const activeSegments = Math.ceil(ratio * count);
    const selectedSegment = Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));

    control.segmentElements.forEach((segment, index) => {
      segment.dataset.active = control.name === 'brightness' && index < activeSegments
        ? 'true'
        : 'false';
      segment.dataset.selected = control.name !== 'brightness' && index === selectedSegment
        ? 'true'
        : 'false';
      if (control.name === 'hue') {
        segment.style.background = `hsl(${(index / Math.max(1, count - 1)) * 360} 85% 65%)`;
      } else if (control.name === 'temperature') {
        const progress = index / Math.max(1, count - 1);
        const red = Math.round(137 + (250 - 137) * progress);
        const green = Math.round(180 + (179 - 180) * progress);
        const blue = Math.round(250 + (135 - 250) * progress);
        segment.style.background = `rgb(${red} ${green} ${blue})`;
      } else {
        segment.style.removeProperty('background');
      }
    });
  }

  _scheduleSegmentLayout() {
    if (this._segmentLayoutFrame !== null) return;
    this._segmentLayoutFrame = requestAnimationFrame(() => {
      this._segmentLayoutFrame = null;
      this._updateSegmentCounts();
    });
  }

  _updateSegmentCounts() {
    for (const control of Object.values(this._controlsByName)) {
      if (control.row.hidden || this._controls.hidden) continue;
      const width = control.track.getBoundingClientRect().width;
      if (width <= 0) continue;
      const count = Math.max(
        1,
        Math.min(
          MAX_SEGMENTS,
          Math.floor((width + MIN_SEGMENT_GAP) / (SEGMENT_SIZE + MIN_SEGMENT_GAP))
        )
      );
      if (count !== control.segmentElements.length) {
        control.segmentElements = Array.from({ length: count }, () => {
          const segment = document.createElement('span');
          segment.className = 'segment';
          return segment;
        });
        control.segments.replaceChildren(...control.segmentElements);
      }
      this._paintSegments(control);
    }
  }

  _toggleControls() {
    if (!this._enabledControlNames().length) return;
    this._controlsExpanded = !this._controlsExpanded;
    this._render();
  }

  _tap() {
    if (!this._hass || !this._config || this._held) {
      this._held = false;
      return;
    }
    executeAction(
      this,
      this._hass,
      this._config,
      this._config.tap_action || DEFAULT_TAP_ACTION
    );
  }

  _startHold() {
    this._cancelHold();
    this._held = false;
    this._holdTimer = window.setTimeout(() => {
      this._holdTimer = null;
      this._held = true;
      if (this._hass && this._config) {
        executeAction(
          this,
          this._hass,
          this._config,
          this._config.hold_action || DEFAULT_HOLD_ACTION
        );
      }
    }, 500);
  }

  _cancelHold() {
    if (this._holdTimer !== null) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _setControl(control) {
    if (!this._hass || !this._config || control.input.disabled) return;
    const value = Number(control.input.value);
    const target = { entity_id: this._config.entity };
    if (control.name === 'brightness') {
      this._hass.callService(
        'light',
        value === 0 ? 'turn_off' : 'turn_on',
        value === 0 ? {} : { brightness_pct: value },
        target
      );
      return;
    }
    if (control.name === 'hue') {
      const saturation = Number(this._entity()?.attributes?.hs_color?.[1]) || 100;
      this._hass.callService('light', 'turn_on', { hs_color: [value, saturation] }, target);
      return;
    }
    if (control.name === 'temperature') {
      this._hass.callService('light', 'turn_on', { color_temp_kelvin: value }, target);
    }
  }
}

defineElement(TAG, TerminalLightCard);
registerCard({
  type: TAG,
  name: 'Terminal Light Card',
  description: 'A terminal-style light control without a border title.',
  documentationURL: DOCUMENTATION_URL,
});
