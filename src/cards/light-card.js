import {
  DOCUMENTATION_URL,
  defineElement,
  executeAction,
  fireMoreInfo,
  registerCard,
} from '../shared/ha.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';

const TAG = 'terminal-light-card';
const DEFAULT_TAP_ACTION = { action: 'toggle' };
const DEFAULT_HOLD_ACTION = { action: 'more-info' };

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    display: block;
  }
  .card {
    box-sizing: border-box;
    min-width: 0;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    transition: border-color 120ms ease;
  }
  .card[data-state="on"] { border-color: var(--terminal-accent); }
  .card[data-state="unavailable"] { border-color: var(--terminal-error); }
  .card:not([data-state="unavailable"]):hover { border-color: var(--terminal-accent); }
  .card:not([data-state="unavailable"]):hover .icon,
  .card:not([data-state="unavailable"]):hover .name { color: var(--terminal-accent); }
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
    border-radius: 50%;
    background: transparent;
    color: var(--terminal-dim);
    line-height: 0;
    cursor: pointer;
  }
  .more[hidden] { display: none; }
  .more:hover, .more:focus-visible {
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
  .brightness {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 42px;
    align-items: center;
    gap: 10px;
    padding: 0 14px 12px;
  }
  .brightness[hidden] { display: none; }
  .dimmer {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 20px;
  }
  .dimmer:focus-within {
    outline: 1px solid var(--terminal-accent);
    outline-offset: 2px;
  }
  .dimmer[data-disabled="true"] { cursor: not-allowed; opacity: .55; }
  .segments {
    display: grid;
    grid-template-columns: repeat(16, minmax(3px, 8px));
    align-items: center;
    justify-content: space-between;
    width: 100%;
    pointer-events: none;
  }
  .segment {
    width: 100%;
    aspect-ratio: 1;
    background: var(--terminal-dim);
    opacity: .42;
  }
  .segment[data-active="true"] {
    background: var(--terminal-accent);
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
  .percent { color: var(--terminal-dim); text-align: right; font-size: 12px; }
`;

export class TerminalLightCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      entity: 'Light entity',
      name: 'Name',
      icon: 'Icon',
      show_state: 'Show state',
      show_brightness: 'Show brightness',
      show_more_info: 'Show more-info button',
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
          type: 'grid',
          name: '',
          flatten: true,
          schema: [
            { name: 'show_state', selector: { boolean: {} } },
            { name: 'show_brightness', selector: { boolean: {} } },
            { name: 'show_more_info', selector: { boolean: {} } },
          ],
        },
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
      computeLabel: (schema) => labels[schema.name],
      computeHelper: (schema) =>
        schema.name === 'show_brightness'
          ? 'Shown only when the selected light supports brightness.'
          : undefined,
    };
  }

  static getStubConfig(hass, entities = []) {
    const candidates = [...entities, ...Object.keys(hass?.states || {})];
    const entity = candidates.find((entityId) => entityId.startsWith('light.')) || '';
    return {
      entity,
      show_state: true,
      show_brightness: true,
      show_more_info: true,
    };
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._holdTimer = null;
    this._held = false;

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
    this._more.title = 'More information';
    this._more.setAttribute('aria-label', 'More information');
    const moreIcon = document.createElement('ha-icon');
    moreIcon.icon = 'mdi:dots-vertical';
    this._more.append(moreIcon);
    this._main.append(this._icon, this._text, this._more);

    this._brightness = document.createElement('div');
    this._brightness.className = 'brightness';
    this._dimmer = document.createElement('div');
    this._dimmer.className = 'dimmer';
    this._segments = document.createElement('div');
    this._segments.className = 'segments';
    this._segments.setAttribute('aria-hidden', 'true');
    this._segmentElements = Array.from({ length: 16 }, () => {
      const segment = document.createElement('span');
      segment.className = 'segment';
      this._segments.append(segment);
      return segment;
    });
    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.min = '0';
    this._slider.max = '100';
    this._slider.setAttribute('aria-label', 'Brightness');
    this._dimmer.append(this._segments, this._slider);
    this._percent = document.createElement('span');
    this._percent.className = 'percent';
    this._brightness.append(this._dimmer, this._percent);
    this._card.append(this._main, this._brightness);
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
      if (this._hass && this._config) fireMoreInfo(this, this._config.entity);
    });
    this._slider.addEventListener('click', (event) => event.stopPropagation());
    this._slider.addEventListener('input', () => {
      this._renderBrightness(Number(this._slider.value));
    });
    this._slider.addEventListener('change', () => this._setBrightness());
  }

  setConfig(config) {
    if (!config?.entity || typeof config.entity !== 'string') {
      throw new Error('terminal-light-card: "entity" is required');
    }
    if (!config.entity.startsWith('light.')) {
      throw new Error('terminal-light-card: "entity" must be a light');
    }
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  disconnectedCallback() {
    this._cancelHold();
    this._hass = null;
  }

  getCardSize() {
    return this._showBrightness() ? 2 : 1;
  }

  getGridOptions() {
    return { columns: 6, rows: 'auto', min_columns: 3 };
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

  _supportsBrightness() {
    const entity = this._entity();
    const modes = entity?.attributes?.supported_color_modes || [];
    return entity?.attributes?.brightness !== undefined || modes.some((mode) => mode !== 'onoff');
  }

  _showBrightness() {
    return this._config?.show_brightness !== false && this._supportsBrightness();
  }

  _render() {
    if (!this._config) return;
    const entity = this._entity();
    const state = this._dataState();
    const unavailable = state === 'unavailable';
    const attributes = entity?.attributes || {};
    const rawBrightness = Math.round(
      ((Number(attributes.brightness) || 0) / 255) * 100
    );
    const brightness = state === 'on'
      ? Math.max(1, Math.min(100, rawBrightness))
      : 0;

    this._card.dataset.state = state;
    this._card.setAttribute('aria-label', this._config.name || attributes.friendly_name || this._config.entity);
    this._icon.icon = this._config.icon || attributes.icon || 'mdi:lightbulb';
    this._name.textContent = this._config.name || attributes.friendly_name || this._config.entity;
    this._state.hidden = this._config.show_state === false;
    const formattedState = entity
      ? this._hass?.formatEntityState?.(entity) || entity.state
      : 'unavailable';
    this._state.textContent = String(formattedState).toLocaleLowerCase();
    this._more.hidden = this._config.show_more_info === false;
    this._brightness.hidden = !this._showBrightness();
    this._slider.value = String(brightness);
    this._slider.disabled = unavailable;
    this._dimmer.dataset.disabled = unavailable ? 'true' : 'false';
    this._renderBrightness(brightness);
    this._main.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
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

  _renderBrightness(value) {
    const brightness = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    const activeSegments = Math.ceil(
      (brightness / 100) * this._segmentElements.length
    );
    this._segmentElements.forEach((segment, index) => {
      segment.dataset.active = index < activeSegments ? 'true' : 'false';
    });
    this._percent.textContent = `${brightness}%`;
  }

  _setBrightness() {
    if (!this._hass || !this._config || this._slider.disabled) return;
    const brightness = Number(this._slider.value);
    this._hass.callService(
      'light',
      brightness === 0 ? 'turn_off' : 'turn_on',
      brightness === 0 ? {} : { brightness_pct: brightness },
      { entity_id: this._config.entity }
    );
  }
}

defineElement(TAG, TerminalLightCard);
registerCard({
  type: TAG,
  name: 'Terminal Light Card',
  description: 'A terminal-style light control without a border title.',
  documentationURL: DOCUMENTATION_URL,
});
