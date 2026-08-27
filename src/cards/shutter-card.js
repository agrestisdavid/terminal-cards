import {
  DOCUMENTATION_URL,
  defineElement,
  executeAction,
  registerCard,
} from '../shared/ha.js';
import {
  appearanceSchema,
  applyAccentColor,
  DEFAULT_MORE_ICON,
  validateAppearance,
} from '../shared/appearance.js';
import {
  closeTerminalEntityPopup,
  updateTerminalEntityPopup,
} from '../shared/popup.js';
import {
  SEGMENT_SIZE,
  segmentCountForWidth,
} from '../shared/segments.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';

const TAG = 'terminal-shutter-card';
const DEFAULT_TAP_ACTION = { action: 'more-info' };
const DEFAULT_HOLD_ACTION = { action: 'more-info' };
const SUPPORT_OPEN = 1;
const SUPPORT_CLOSE = 2;
const SUPPORT_SET_POSITION = 4;
const SUPPORT_STOP = 8;
const SUPPORT_SET_TILT_POSITION = 64;

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
    transition: border-color 120ms ease;
  }
  .card[data-state="open"],
  .card[data-state="opening"],
  .card[data-state="closing"] { border-color: var(--terminal-accent); }
  .card[data-state="unavailable"] { border-color: var(--terminal-error); }
  .card:not([data-state="unavailable"]):hover {
    border-color: var(--terminal-accent);
  }
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
  .card[data-state="open"] .icon,
  .card[data-state="opening"] .icon,
  .card[data-state="closing"] .icon { color: var(--terminal-accent); }
  .card[data-state="unavailable"] .icon { color: var(--terminal-error); }
  .text { flex: 1 1 auto; min-width: 0; pointer-events: none; }
  .name, .state { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name { font-weight: 600; }
  .state { color: var(--terminal-dim); font-size: 12px; }
  .card[data-state="unavailable"] .state { color: var(--terminal-error); }
  .expand {
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
  .expand[hidden] { display: none; }
  .expand:hover, .expand:focus-visible, .expand[aria-expanded="true"] {
    border-color: currentColor;
    color: var(--terminal-accent);
    outline: none;
  }
  .expand ha-icon { width: 20px; height: 20px; --mdc-icon-size: 20px; }
  .controls {
    display: grid;
    gap: 8px;
    margin-top: auto;
    padding: 0 14px 12px;
  }
  .controls[hidden], .range[hidden], .commands[hidden] { display: none; }
  .commands, .range {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }
  .command-buttons {
    display: grid;
    grid-template-columns: repeat(var(--terminal-command-count, 1), minmax(0, 1fr));
    grid-column: 1 / -1;
    gap: 8px;
    width: 100%;
  }
  .command {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 30px;
    padding: 0;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    cursor: pointer;
  }
  .command[hidden] { display: none; }
  .command:hover, .command:focus-visible {
    border-color: var(--terminal-accent);
    color: var(--terminal-accent);
    outline: none;
  }
  .command:disabled { cursor: not-allowed; opacity: .45; }
  .command ha-icon { width: 18px; height: 18px; --mdc-icon-size: 18px; }
  .range-main {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .range-label, .range-value {
    color: var(--terminal-dim);
    font-size: 11px;
    white-space: nowrap;
  }
  .range-value { text-align: center; }
  .track {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 20px;
  }
  .track:focus-within { outline: 1px solid var(--terminal-accent); outline-offset: 2px; }
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
    background: var(--terminal-dim);
    opacity: .42;
  }
  .segment[data-active="true"] { background: var(--terminal-accent); opacity: 1; }
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

export class TerminalShutterCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      entity: 'Cover entity',
      name: 'Name',
      icon: 'Icon',
      show_state: 'Show state',
      show_controls: 'Show controls button',
      show_position: 'Show position',
      show_tilt: 'Show tilt position',
      controls_expanded: 'Expand controls by default',
      accent_color: 'Accent color',
      more_icon: 'Controls icon',
      tap_action: 'Tap action',
      hold_action: 'Hold action',
    };
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { domain: 'cover' } } },
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
            { name: 'show_controls', default: true, selector: { boolean: {} } },
            { name: 'show_position', default: true, selector: { boolean: {} } },
            { name: 'show_tilt', default: true, selector: { boolean: {} } },
            { name: 'controls_expanded', default: false, selector: { boolean: {} } },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Appearance',
          flatten: true,
          schema: appearanceSchema({ moreIcon: true }),
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
                  actions: ['more-info', 'navigate', 'url', 'perform-action', 'none'],
                  default_action: 'more-info',
                },
              },
            },
            {
              name: 'hold_action',
              selector: {
                ui_action: {
                  actions: ['more-info', 'navigate', 'url', 'perform-action', 'none'],
                  default_action: 'more-info',
                },
              },
            },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) => {
        if (schema.name === 'show_position') return 'Shown only when position is supported.';
        if (schema.name === 'show_tilt') return 'Shown only when tilt position is supported.';
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    const candidates = [...entities, ...Object.keys(hass?.states || {})];
    const entity = candidates.find((entityId) => entityId.startsWith('cover.')) || '';
    return {
      entity,
      show_state: true,
      show_controls: true,
      show_position: true,
      show_tilt: true,
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
    this._layoutFrame = null;
    this._ranges = {};
    this._resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this._updateSegmentCounts())
      : null;

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
    this._expand = document.createElement('button');
    this._expand.className = 'expand';
    this._expand.type = 'button';
    this._expand.title = 'Toggle shutter controls';
    this._expand.setAttribute('aria-label', 'Toggle shutter controls');
    this._expand.setAttribute('aria-controls', 'terminal-shutter-controls');
    this._expandIcon = document.createElement('ha-icon');
    this._expandIcon.icon = DEFAULT_MORE_ICON;
    this._expand.append(this._expandIcon);
    this._main.append(this._icon, this._text, this._expand);

    this._controls = document.createElement('div');
    this._controls.id = 'terminal-shutter-controls';
    this._controls.className = 'controls';
    this._commands = document.createElement('div');
    this._commands.className = 'commands';
    this._commandButtons = document.createElement('div');
    this._commandButtons.className = 'command-buttons';
    this._open = this._commandButton('mdi:arrow-up', 'Open', 'open_cover');
    this._stop = this._commandButton('mdi:stop', 'Stop', 'stop_cover');
    this._close = this._commandButton('mdi:arrow-down', 'Close', 'close_cover');
    this._commandButtons.append(this._open, this._stop, this._close);
    this._commands.append(this._commandButtons);
    this._controls.append(this._commands);
    this._createRange('position', 'pos', 'set_cover_position', 'position');
    this._createRange('tilt', 'tilt', 'set_cover_tilt_position', 'tilt_position');
    this._card.append(this._main, this._controls);
    root.append(style, this._card);

    this._main.addEventListener('click', () => this._tap());
    this._main.addEventListener('keydown', (event) => {
      if (event.target !== this._main) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        this._tap();
      } else if (event.key === ' ' && !event.repeat) {
        event.preventDefault();
        this._startHold();
      }
    });
    this._main.addEventListener('keyup', (event) => {
      if (event.target !== this._main || event.key !== ' ') return;
      event.preventDefault();
      this._cancelHold();
      this._tap();
    });
    this._main.addEventListener('pointerdown', () => this._startHold());
    for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
      this._main.addEventListener(eventName, () => this._cancelHold());
    }
    this._expand.addEventListener('pointerdown', (event) => event.stopPropagation());
    this._expand.addEventListener('click', (event) => {
      event.stopPropagation();
      this._controlsExpanded = !this._controlsExpanded;
      this._render();
    });
  }

  connectedCallback() {
    this._resizeObserver?.observe(this._card);
    this._scheduleLayout();
  }

  disconnectedCallback() {
    this._cancelHold();
    closeTerminalEntityPopup(this);
    this._resizeObserver?.disconnect();
    if (this._layoutFrame !== null) {
      cancelAnimationFrame(this._layoutFrame);
      this._layoutFrame = null;
    }
    this._hass = null;
  }

  setConfig(config) {
    closeTerminalEntityPopup(this);
    if (!config?.entity || typeof config.entity !== 'string') {
      throw new Error('terminal-shutter-card: "entity" is required');
    }
    if (!config.entity.startsWith('cover.')) {
      throw new Error('terminal-shutter-card: "entity" must be a cover');
    }
    validateAppearance(config, 'terminal-shutter-card');
    const previousDefault = this._config?.controls_expanded;
    this._config = { ...config };
    if (previousDefault !== config.controls_expanded) {
      this._controlsExpanded = config.controls_expanded === true;
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    updateTerminalEntityPopup(hass);
    this._render();
  }

  getCardSize() {
    if (!this._controlsExpanded) return 1;
    const rowCount = Number(!this._commands.hidden) +
      Object.values(this._ranges).filter((range) => !range.row.hidden).length;
    return 1 + Math.ceil(rowCount / 2);
  }

  getGridOptions() {
    return { columns: 6, rows: 'auto', min_columns: 3 };
  }

  _entity() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _features() {
    return Number(this._entity()?.attributes?.supported_features) || 0;
  }

  _supports(feature) {
    return (this._features() & feature) !== 0;
  }

  _dataState() {
    const entity = this._entity();
    if (!entity || entity.state === 'unavailable' || entity.state === 'unknown') {
      return 'unavailable';
    }
    return entity.state;
  }

  _commandButton(icon, label, service) {
    const button = document.createElement('button');
    button.className = 'command';
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    const iconElement = document.createElement('ha-icon');
    iconElement.icon = icon;
    button.append(iconElement);
    button.addEventListener('click', () => this._callCoverService(service));
    return button;
  }

  _createRange(name, label, service, dataKey) {
    const row = document.createElement('div');
    row.className = 'range';
    row.dataset.control = name;
    const main = document.createElement('div');
    main.className = 'range-main';
    const labelElement = document.createElement('span');
    labelElement.className = 'range-label';
    labelElement.textContent = label;
    const track = document.createElement('div');
    track.className = 'track';
    const segments = document.createElement('div');
    segments.className = 'segments';
    segments.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.setAttribute('aria-label', label);
    track.append(segments, input);
    main.append(labelElement, track);
    const value = document.createElement('span');
    value.className = 'range-value';
    row.append(main, value);
    this._controls.append(row);
    const range = {
      name,
      service,
      dataKey,
      row,
      track,
      segments,
      input,
      value,
      segmentElements: [],
      currentValue: 0,
    };
    input.addEventListener('input', () => this._renderRange(range, Number(input.value)));
    input.addEventListener('change', () => {
      this._callCoverService(service, { [dataKey]: Number(input.value) });
    });
    this._ranges[name] = range;
  }

  _render() {
    if (!this._config) return;
    applyAccentColor(this, this._config.accent_color);
    const entity = this._entity();
    const attributes = entity?.attributes || {};
    const state = this._dataState();
    const unavailable = state === 'unavailable';
    this._card.dataset.state = state;
    this._card.setAttribute(
      'aria-label',
      this._config.name || attributes.friendly_name || this._config.entity
    );
    this._icon.icon = this._config.icon || attributes.icon || 'mdi:blinds-horizontal';
    this._expandIcon.icon = this._config.more_icon || DEFAULT_MORE_ICON;
    this._name.textContent = this._config.name || attributes.friendly_name || this._config.entity;
    this._state.hidden = this._config.show_state === false;
    const formattedState = entity
      ? this._hass?.formatEntityState?.(entity) || entity.state
      : 'unavailable';
    this._state.textContent = String(formattedState).toLocaleLowerCase();

    this._open.hidden = !this._supports(SUPPORT_OPEN);
    this._stop.hidden = !this._supports(SUPPORT_STOP);
    this._close.hidden = !this._supports(SUPPORT_CLOSE);
    const visibleCommands = [this._open, this._stop, this._close]
      .filter((button) => !button.hidden);
    this._commandButtons.style.setProperty(
      '--terminal-command-count',
      String(Math.max(1, visibleCommands.length))
    );
    for (const button of visibleCommands) button.disabled = unavailable;
    this._commands.hidden = this._open.hidden && this._stop.hidden && this._close.hidden;

    const rawPosition = Number(attributes.current_position);
    const rawTilt = Number(attributes.current_tilt_position);
    const position = Math.max(
      0,
      Math.min(100, Number.isFinite(rawPosition) ? rawPosition : (state === 'open' ? 100 : 0))
    );
    const tilt = Math.max(0, Math.min(100, Number.isFinite(rawTilt) ? rawTilt : 0));
    const positionRange = this._ranges.position;
    positionRange.row.hidden = this._config.show_position === false ||
      !this._supports(SUPPORT_SET_POSITION);
    const tiltRange = this._ranges.tilt;
    tiltRange.row.hidden = this._config.show_tilt === false ||
      !this._supports(SUPPORT_SET_TILT_POSITION);
    for (const range of [positionRange, tiltRange]) {
      range.input.disabled = unavailable;
      range.track.dataset.disabled = unavailable ? 'true' : 'false';
    }
    this._renderRange(positionRange, position);
    this._renderRange(tiltRange, tilt);

    const hasControls = !this._commands.hidden || !positionRange.row.hidden || !tiltRange.row.hidden;
    this._expand.hidden = this._config.show_controls === false || !hasControls;
    const expanded = this._controlsExpanded && hasControls;
    this._expand.setAttribute('aria-expanded', String(expanded));
    this._controls.hidden = !expanded;
    this._main.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
    if (expanded) {
      this._updateSegmentCounts();
      this._scheduleLayout();
    }
  }

  _renderRange(range, value) {
    const normalized = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    range.currentValue = normalized;
    range.input.value = String(normalized);
    range.value.textContent = `${normalized}%`;
    const active = Math.ceil((normalized / 100) * range.segmentElements.length);
    range.segmentElements.forEach((segment, index) => {
      segment.dataset.active = index < active ? 'true' : 'false';
    });
  }

  _scheduleLayout() {
    if (this._layoutFrame !== null) return;
    this._layoutFrame = requestAnimationFrame(() => {
      this._layoutFrame = null;
      this._updateSegmentCounts();
    });
  }

  _updateSegmentCounts() {
    for (const range of Object.values(this._ranges)) {
      if (range.row.hidden || this._controls.hidden) continue;
      const width = range.track.getBoundingClientRect().width;
      if (width <= 0) continue;
      const count = segmentCountForWidth(width);
      if (count !== range.segmentElements.length) {
        range.segmentElements = Array.from({ length: count }, () => {
          const segment = document.createElement('span');
          segment.className = 'segment';
          return segment;
        });
        range.segments.replaceChildren(...range.segmentElements);
      }
      this._renderRange(range, range.currentValue);
    }
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

  _callCoverService(service, data = {}) {
    if (!this._hass || !this._config || this._dataState() === 'unavailable') return;
    this._hass.callService(
      'cover',
      service,
      data,
      { entity_id: this._config.entity }
    );
  }
}

defineElement(TAG, TerminalShutterCard);
registerCard({
  type: TAG,
  name: 'Terminal Shutter Card',
  description: 'A terminal-style shutter and blind control for cover entities.',
  documentationURL: DOCUMENTATION_URL,
});
