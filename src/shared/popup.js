import {
  alarmControlModel,
  alarmDefaultCode,
  sanitizeAlarmCode,
} from './alarm.js';
import { applyAccentColor } from './appearance.js';
import {
  activeLightColor,
  COLOR_MODES,
  lightColorTemperature,
  lightTemperatureBounds,
} from './light-color.js';
import {
  hueSegmentColor,
  SEGMENT_SIZE,
  segmentCountForWidth,
  temperatureSegmentColor,
} from './segments.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from './styles.js';
import { DEFAULT_TITLE_FONT_SIZE } from './title.js';

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
  .dialog-shell {
    --terminal-popup-effective-accent: var(
      --terminal-popup-light-color,
      var(--terminal-accent)
    );
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    width: min(480px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    padding: 14px;
    border: 0;
    background: var(--terminal-background);
    overflow: visible;
  }
  .dialog-frame {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    max-height: calc(100vh - 60px);
    overflow: visible;
  }
  .dialog {
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: inherit;
    border: 1px solid var(--terminal-popup-effective-accent);
    border-radius: 0;
    background: var(--terminal-background);
    overflow: hidden;
    outline: none;
  }
  .border-title {
    position: absolute;
    z-index: 2;
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
    font: 700 ${DEFAULT_TITLE_FONT_SIZE}px/1.2 ${TERMINAL_FONT};
  }
  .header {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 64px;
    padding: 18px 14px 8px;
  }
  .entity-icon {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    color: var(--terminal-popup-effective-accent);
    --mdc-icon-size: 32px;
  }
  .header-text {
    display: grid;
    flex: 1 1 auto;
    gap: 2px;
    min-width: 0;
  }
  .entity-name, .state {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entity-name {
    color: var(--terminal-text);
    font-size: 13px;
    font-weight: 600;
  }
  .state {
    color: var(--terminal-dim);
    font-size: 12px;
  }
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
    flex: 1 1 auto;
    align-content: start;
    gap: 16px;
    min-height: 0;
    max-height: calc(100vh - 112px);
    padding: 4px 14px 14px;
    overflow: auto;
  }
  .section { display: grid; gap: 8px; }
  .section-title {
    color: var(--terminal-popup-effective-accent);
    font-size: 11px;
    font-weight: 600;
  }
  .logbook-section {
    position: relative;
    box-sizing: border-box;
    display: block;
    min-width: 0;
    border: 1px solid var(--terminal-dim);
    transition: border-color 120ms ease;
  }
  .logbook-section[data-open="true"] {
    padding: 16px 10px 10px;
    border-color: var(--terminal-popup-effective-accent);
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
  .actions.alarm-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .action { width: 100%; gap: 7px; }
  .alarm-code {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }
  .alarm-code label { color: var(--terminal-dim); font-size: 11px; }
  .alarm-code input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: transparent;
    color: var(--terminal-text);
    font: 13px ${TERMINAL_FONT};
  }
  .alarm-code input:hover,
  .alarm-code input:focus-visible {
    border-color: var(--terminal-popup-effective-accent);
    outline: none;
  }
  .alarm-error {
    min-height: 1.4em;
    color: var(--terminal-error);
    font-size: 11px;
  }
  .logs-toggle {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    font: 600 11px ${TERMINAL_FONT};
    cursor: pointer;
  }
  .logs-toggle:hover, .logs-toggle:focus-visible,
  .logs-toggle[aria-expanded="true"] {
    color: var(--terminal-popup-effective-accent);
    outline: none;
  }
  .logbook-section[data-open="true"] .logs-toggle {
    position: absolute;
    top: 0;
    right: 10px;
    left: 10px;
    width: auto;
    min-height: 18px;
    padding: 0;
    transform: translateY(-50%);
    background: transparent;
  }
  .logbook-section[data-open="true"] .logs-label {
    padding: 0 8px;
    background: var(--terminal-background);
  }
  .logs-toggle ha-icon {
    width: 18px;
    height: 18px;
    --mdc-icon-size: 18px;
  }
  .logbook-section[data-open="true"] .logs-toggle ha-icon {
    box-sizing: content-box;
    margin-left: auto;
    padding: 0 4px;
    background: var(--terminal-background);
  }
  .log-tree {
    display: grid;
    gap: 6px;
    padding: 0;
    font-size: 11px;
  }
  .log-tree[hidden] { display: none; }
  .log-line {
    display: grid;
    grid-template-columns: max-content max-content minmax(0, 1fr);
    gap: 7px;
    min-width: 0;
  }
  .log-branch { color: var(--terminal-popup-effective-accent); white-space: pre; }
  .log-time { color: var(--terminal-dim); white-space: nowrap; }
  .log-value {
    min-width: 0;
    overflow: hidden;
    color: var(--terminal-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .log-context { color: var(--terminal-dim); }
  .log-status { color: var(--terminal-dim); white-space: pre-wrap; }
  .action:disabled { cursor: not-allowed; opacity: .45; }
  .range {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }
  .range-main {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .range-label, .range-value { color: var(--terminal-dim); font-size: 11px; }
  .range-value { text-align: right; }
  .track {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 20px;
  }
  .track:focus-within {
    outline: 1px solid var(--terminal-popup-effective-accent);
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
  .range[data-kind="brightness"] .segment[data-active="true"],
  .range[data-kind="position"] .segment[data-active="true"],
  .range[data-kind="tilt"] .segment[data-active="true"] {
    background: var(--terminal-popup-effective-accent);
    opacity: 1;
  }
  .range[data-kind="hue"] .segment[data-selected="true"],
  .range[data-kind="temperature"] .segment[data-selected="true"] {
    border: 1px solid var(--terminal-popup-effective-accent);
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
  @media (max-width: 600px) {
    :host {
      box-sizing: border-box;
      padding: max(12vh, calc(env(safe-area-inset-top) + 12px)) 8px
        max(12vh, calc(env(safe-area-inset-bottom) + 8px));
      padding-top: max(12dvh, calc(env(safe-area-inset-top) + 12px));
      padding-bottom: max(12dvh, calc(env(safe-area-inset-bottom) + 8px));
      place-items: stretch;
    }
    .backdrop { background: var(--terminal-background); }
    .dialog-shell {
      width: 100%;
      height: 100%;
      max-height: none;
      padding: 0;
    }
    .dialog-frame, .dialog { height: 100%; max-height: none; }
    .border-title {
      max-width: calc(100% - 64px);
      font-size: 18px;
    }
    .header { min-height: 62px; padding: 17px 12px 7px; }
    .entity-icon { width: 28px; height: 28px; --mdc-icon-size: 28px; }
    .close { flex-basis: 34px; width: 34px; min-width: 34px; }
    .body {
      max-height: none;
      padding: 4px 12px 14px;
      overscroll-behavior: contain;
    }
    .details { gap: 6px 10px; }
    .range { grid-template-columns: minmax(0, 1fr) 38px; gap: 8px; }
    .range-main { grid-template-columns: 30px minmax(0, 1fr); gap: 6px; }
    .actions { gap: 6px; }
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
    this._rangeControls = [];
    this._layoutFrame = null;
    this._logGeneration = 0;
    this._logRefreshTimer = null;
    this._logsOpen = false;
    this._logLoading = false;
    this._logEntries = null;
    this._logError = null;
    this._logTree = null;
    this._logsSection = null;
    this._logsToggle = null;
    this._logsIcon = null;
    this._alarmCode = '';
    this._alarmError = '';
    this._alarmBusy = false;
    this._alarmOperationGeneration = 0;
    this._alarmInput = null;
    this._resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this._updateSegmentCounts())
      : null;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'backdrop';
    this._dialogShell = document.createElement('div');
    this._dialogShell.className = 'dialog-shell';
    this._dialogFrame = document.createElement('div');
    this._dialogFrame.className = 'dialog-frame';
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
    this._entityName = document.createElement('div');
    this._entityName.className = 'entity-name';
    this._state = document.createElement('div');
    this._state.className = 'state';
    this._headerText.append(this._entityName, this._state);
    this._close = document.createElement('button');
    this._close.className = 'close';
    this._close.type = 'button';
    this._close.dataset.focusKey = 'close';
    this._close.title = 'close';
    this._close.setAttribute('aria-label', 'close terminal details');
    this._close.append(iconElement('mdi:close'));
    this._header.append(this._entityIcon, this._headerText, this._close);
    this._body = document.createElement('div');
    this._body.className = 'body';
    this._dialog.append(this._header, this._body);
    this._dialogFrame.append(this._borderTitle, this._dialog);
    this._dialogShell.append(this._dialogFrame);
    root.append(style, this._backdrop, this._dialogShell);

    this._close.addEventListener('click', () => this.close());
    this._backdrop.addEventListener('click', () => this.close());
    this.addEventListener('keydown', (event) => this._handleKeydown(event));
  }

  connectedCallback() {
    this._resizeObserver?.observe(this._dialog);
  }

  disconnectedCallback() {
    this._cancelLogbookRefresh();
    if (!this.hidden) {
      this.close();
    } else {
      ++this._logGeneration;
      this._hass = null;
      this._config = null;
      this._entityId = null;
      this._trigger = null;
      this._returnFocus = null;
      this._rangeControls = [];
      this._logLoading = false;
      this._logEntries = null;
      this._logError = null;
      this._logTree = null;
      this._logsSection = null;
      this._logsToggle = null;
      this._logsIcon = null;
      if (this._alarmInput) this._alarmInput.value = '';
      this._alarmCode = '';
      this._alarmError = '';
      this._alarmBusy = false;
      ++this._alarmOperationGeneration;
      this._alarmInput = null;
      this._body.replaceChildren();
    }
    this._resizeObserver?.disconnect();
    if (this._layoutFrame !== null) {
      cancelAnimationFrame(this._layoutFrame);
      this._layoutFrame = null;
    }
  }

  show(trigger, hass, config) {
    this._cancelLogbookRefresh();
    ++this._logGeneration;
    this._trigger = trigger;
    this._returnFocus = trigger?.shadowRoot?.activeElement || trigger;
    this._hass = hass;
    this._config = { ...config };
    this._entityId = config.entity;
    this._logsOpen = false;
    this._logLoading = false;
    this._logEntries = null;
    this._logError = null;
    if (this._alarmInput) this._alarmInput.value = '';
    this._alarmCode = '';
    this._alarmError = '';
    this._alarmBusy = false;
    ++this._alarmOperationGeneration;
    this._alarmInput = null;
    this._render();
    this.hidden = false;
    this._updateSegmentCounts();
    this._scheduleSegmentLayout();
    requestAnimationFrame(() => {
      if (!this.hidden) this._close.focus();
    });
  }

  updateHass(hass) {
    if (this.hidden) return;
    const previousEntity = this._entity();
    const nextEntity = hass?.states?.[this._entityId] || null;
    const entityChanged = previousEntity !== nextEntity;
    const connectionChanged = this._hass?.connection !== hass?.connection;
    const focusKey = this._captureFocusKey();
    if (connectionChanged) {
      this._cancelLogbookRefresh();
      ++this._logGeneration;
      this._logLoading = false;
      this._logEntries = null;
      this._logError = null;
      if (this._alarmInput) this._alarmInput.value = '';
      this._alarmCode = '';
      this._alarmError = '';
      this._alarmBusy = false;
      ++this._alarmOperationGeneration;
    }
    this._hass = hass;
    if (!this.hidden) {
      this._render();
      this._restoreFocusKey(focusKey);
      this._updateSegmentCounts();
      this._scheduleSegmentLayout();
      if (connectionChanged && this._logsOpen) this._loadLogbook();
      else if (entityChanged && this._logsOpen) this._scheduleLogbookRefresh();
    }
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
    this._rangeControls = [];
    this._cancelLogbookRefresh();
    ++this._logGeneration;
    this._logsOpen = false;
    this._logLoading = false;
    this._logEntries = null;
    this._logError = null;
    this._logTree = null;
    this._logsSection = null;
    this._logsToggle = null;
    this._logsIcon = null;
    if (this._alarmInput) this._alarmInput.value = '';
    this._alarmCode = '';
    this._alarmError = '';
    this._alarmBusy = false;
    ++this._alarmOperationGeneration;
    this._alarmInput = null;
    this._body.replaceChildren();
    if (this._layoutFrame !== null) {
      cancelAnimationFrame(this._layoutFrame);
      this._layoutFrame = null;
    }
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
    const popupTitle = this._config?.popup_title || 'more-info';
    const formattedState = entity
      ? this._hass?.formatEntityState?.(entity) || entity.state
      : 'unavailable';
    this._dialog.setAttribute('aria-label', `${name} ${popupTitle}`);
    this._borderTitle.textContent = popupTitle;
    this._entityIcon.icon = this._config?.icon || attributes.icon || this._defaultIcon(domain);
    this._entityName.textContent = name;
    this._state.textContent = String(formattedState).toLocaleLowerCase();
    this._rangeControls = [];
    if (this._alarmInput) this._alarmInput.value = '';
    this._body.replaceChildren();
    this._body.append(this._detailsSection(entity, attributes, domain));

    const controls = domain === 'light'
      ? this._lightControls(entity, attributes, unavailable)
      : domain === 'cover'
        ? this._coverControls(attributes, unavailable)
        : domain === 'alarm_control_panel'
          ? this._alarmControls(entity, attributes, unavailable)
          : null;
    if (controls) this._body.append(controls);
    this._body.append(this._logbookSection());
  }

  _logbookSection() {
    const section = document.createElement('section');
    section.className = 'section logbook-section';
    section.dataset.open = String(this._logsOpen);
    this._logsSection = section;
    this._logsToggle = document.createElement('button');
    this._logsToggle.className = 'logs-toggle';
    this._logsToggle.type = 'button';
    this._logsToggle.dataset.focusKey = 'logs';
    this._logsToggle.setAttribute('aria-controls', 'terminal-popup-logbook');
    this._logsToggle.setAttribute('aria-expanded', String(this._logsOpen));
    const label = document.createElement('span');
    label.className = 'logs-label';
    label.textContent = 'logs';
    this._logsIcon = iconElement(
      this._logsOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'
    );
    this._logsToggle.append(label, this._logsIcon);
    this._logTree = document.createElement('div');
    this._logTree.id = 'terminal-popup-logbook';
    this._logTree.className = 'log-tree';
    this._logTree.setAttribute('role', 'list');
    this._logTree.hidden = !this._logsOpen;
    this._logsToggle.addEventListener('click', () => this._toggleLogbook());
    section.append(this._logsToggle, this._logTree);
    this._renderLogbook();
    return section;
  }

  _toggleLogbook() {
    this._logsOpen = !this._logsOpen;
    this._logsToggle?.setAttribute('aria-expanded', String(this._logsOpen));
    if (this._logsIcon) {
      this._logsIcon.icon = this._logsOpen ? 'mdi:chevron-up' : 'mdi:chevron-down';
    }
    if (this._logTree) this._logTree.hidden = !this._logsOpen;
    if (this._logsSection) this._logsSection.dataset.open = String(this._logsOpen);
    if (!this._logsOpen) this._cancelLogbookRefresh();
    if (
      this._logsOpen &&
      !this._logLoading &&
      this._logEntries === null
    ) {
      this._loadLogbook();
    } else {
      this._renderLogbook();
    }
  }

  _scheduleLogbookRefresh() {
    this._cancelLogbookRefresh();
    this._logRefreshTimer = setTimeout(() => {
      this._logRefreshTimer = null;
      if (!this.hidden && this._logsOpen) this._loadLogbook();
    }, 500);
  }

  _cancelLogbookRefresh() {
    if (this._logRefreshTimer !== null) {
      clearTimeout(this._logRefreshTimer);
      this._logRefreshTimer = null;
    }
  }

  _loadLogbook() {
    if (!this._hass?.callWS || !this._entityId) {
      this._logError = 'logbook unavailable';
      this._renderLogbook();
      return;
    }
    const generation = ++this._logGeneration;
    this._logLoading = true;
    this._logError = null;
    this._renderLogbook();
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const hass = this._hass;
    const connection = hass.connection;
    const entityId = this._entityId;
    const requestIsCurrent = () =>
      generation === this._logGeneration &&
      !this.hidden &&
      this._entityId === entityId &&
      this._hass?.connection === connection;
    const params = {
      type: 'logbook/get_events',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: [entityId],
    };
    Promise.resolve().then(() => {
      if (!requestIsCurrent()) return [];
      return hass.callWS(params);
    }).then((entries) => {
      if (!requestIsCurrent()) return;
      const list = Array.isArray(entries) ? [...entries] : [];
      list.sort((left, right) => this._logTimestamp(right.when) - this._logTimestamp(left.when));
      this._logEntries = list.slice(0, 6);
      this._logLoading = false;
      this._renderLogbook();
    }).catch(() => {
      if (!requestIsCurrent()) return;
      this._logLoading = false;
      this._logError = 'logbook unavailable';
      this._renderLogbook();
    });
  }

  _renderLogbook() {
    if (!this._logTree) return;
    this._logTree.replaceChildren();
    if (this._logLoading) {
      this._logTree.append(this._logStatus('│ loading…'));
      return;
    }
    if (this._logError) {
      this._logTree.append(this._logStatus(`└─ ${this._logError}`));
      return;
    }
    if (this._logEntries === null) {
      this._logTree.append(this._logStatus('└─ open to load recent changes'));
      return;
    }
    if (!this._logEntries.length) {
      this._logTree.append(this._logStatus('└─ no changes in the last 24 hours'));
      return;
    }

    this._logEntries.forEach((entry, index) => {
      const last = index === this._logEntries.length - 1;
      const line = document.createElement('div');
      line.className = 'log-line';
      line.setAttribute('role', 'listitem');
      const branch = document.createElement('span');
      branch.className = 'log-branch';
      branch.textContent = last ? '└─' : '├─';
      const time = document.createElement('time');
      time.className = 'log-time';
      const timestamp = this._logTimestamp(entry.when);
      if (Number.isFinite(timestamp)) time.dateTime = new Date(timestamp).toISOString();
      time.textContent = this._formatLogTime(timestamp);
      const stateValue = entry.state === undefined
        ? null
        : String(entry.state).toLocaleLowerCase();
      const rawService = entry.context_service;
      const service = rawService
        ? String(rawService).includes('.')
          ? String(rawService)
          : `${this._entityId?.split('.', 1)[0] || 'homeassistant'}.${rawService}`
        : null;
      const value = document.createElement('span');
      value.className = 'log-value';
      value.textContent = service
        ? ''
        : String(
          entry.state ?? entry.message ?? entry.context_message ?? 'changed'
        ).toLocaleLowerCase();
      line.append(branch, time, value);
      this._logTree.append(line);

      const context = service
        ? `${service}${stateValue ? ` · ${stateValue}` : ''}`
        : entry.source || entry.context_name || entry.context_message ||
          (entry.state === undefined ? null : entry.message);
      if (context) {
        const contextLine = document.createElement('div');
        contextLine.className = 'log-line log-context';
        const contextBranch = document.createElement('span');
        contextBranch.className = 'log-branch';
        contextBranch.textContent = last ? '  └─' : '│ └─';
        const spacer = document.createElement('span');
        const contextValue = document.createElement('span');
        contextValue.className = 'log-value log-context';
        contextValue.textContent = String(context).toLocaleLowerCase();
        contextLine.append(contextBranch, spacer, contextValue);
        this._logTree.append(contextLine);
      }
    });
  }

  _logStatus(text) {
    const status = document.createElement('div');
    status.className = 'log-status';
    status.textContent = text;
    return status;
  }

  _logTimestamp(value) {
    if (typeof value === 'number') return value * 1000;
    return Date.parse(value);
  }

  _formatLogTime(timestamp) {
    if (!Number.isFinite(timestamp)) return '--.-- --:--';
    try {
      return new Intl.DateTimeFormat(this._hass?.locale?.language, {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(timestamp));
    } catch (_error) {
      return new Date(timestamp).toLocaleString();
    }
  }

  _captureFocusKey() {
    const active = this.shadowRoot?.activeElement;
    if (!active || !this._dialog.contains(active)) return null;
    if (active === this._dialog) return 'dialog';
    return active.dataset?.focusKey || 'dialog';
  }

  _restoreFocusKey(focusKey) {
    if (!focusKey) return;
    const target = focusKey === 'dialog'
      ? this._dialog
      : [...this.shadowRoot.querySelectorAll('[data-focus-key]')]
        .find((element) =>
          element.dataset.focusKey === focusKey && !element.closest('[hidden]')
        );
    const usableTarget = target?.disabled ? null : target;
    const fallback = this._close?.isConnected ? this._close : this._dialog;
    (usableTarget || fallback)?.focus?.();
  }

  _defaultIcon(domain) {
    if (domain === 'light') return 'mdi:lightbulb';
    if (domain === 'cover') return 'mdi:blinds-horizontal';
    if (domain === 'alarm_control_panel') return 'mdi:shield-home-outline';
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
    buttons.forEach((button, index) => {
      if (!button.dataset.focusKey) button.dataset.focusKey = `action:${index}`;
    });
    actions.append(...buttons);
    return actions;
  }

  _range(kind, label, value, min, max, step, callback, disabled = false, suffix = '%') {
    const row = document.createElement('div');
    row.className = 'range';
    row.dataset.kind = kind;
    const main = document.createElement('label');
    main.className = 'range-main';
    const labelElement = document.createElement('span');
    labelElement.className = 'range-label';
    labelElement.textContent = label;
    const track = document.createElement('span');
    track.className = 'track';
    track.dataset.disabled = disabled ? 'true' : 'false';
    const segments = document.createElement('span');
    segments.className = 'segments';
    segments.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.disabled = disabled;
    input.dataset.focusKey = `range:${kind}`;
    input.setAttribute('aria-label', label);
    track.append(segments, input);
    main.append(labelElement, track);
    const valueElement = document.createElement('span');
    valueElement.className = 'range-value';
    row.append(main, valueElement);

    const control = {
      kind,
      row,
      track,
      segments,
      input,
      value: valueElement,
      min,
      max,
      suffix,
      currentValue: min,
      segmentElements: [],
    };
    input.addEventListener('input', () => {
      this._renderRange(control, Number(input.value));
    });
    input.addEventListener('change', () => callback(Number(input.value)));
    this._rangeControls.push(control);
    this._renderRange(control, value);
    return row;
  }

  _renderRange(control, value) {
    const normalized = Math.max(
      control.min,
      Math.min(control.max, Math.round(Number(value) || control.min))
    );
    control.currentValue = normalized;
    control.input.value = String(normalized);
    control.value.textContent = `${normalized}${control.suffix}`;
    this._paintRange(control);
  }

  _paintRange(control) {
    const count = control.segmentElements.length;
    if (!count) return;
    const range = Math.max(1, control.max - control.min);
    const ratio = (control.currentValue - control.min) / range;
    const activeSegments = Math.ceil(ratio * count);
    const selectedSegment = Math.min(
      count - 1,
      Math.max(0, Math.round(ratio * (count - 1)))
    );
    control.segmentElements.forEach((segment, index) => {
      const fill = ['brightness', 'position', 'tilt'].includes(control.kind);
      segment.dataset.active = fill && index < activeSegments ? 'true' : 'false';
      segment.dataset.selected = !fill && index === selectedSegment ? 'true' : 'false';
      if (control.kind === 'hue') {
        segment.style.background = hueSegmentColor(index, count);
      } else if (control.kind === 'temperature') {
        segment.style.background = temperatureSegmentColor(index, count);
      } else {
        segment.style.removeProperty('background');
      }
    });
  }

  _scheduleSegmentLayout() {
    if (this._layoutFrame !== null) return;
    this._layoutFrame = requestAnimationFrame(() => {
      this._layoutFrame = null;
      this._updateSegmentCounts();
    });
  }

  _updateSegmentCounts() {
    if (this.hidden) return;
    for (const control of this._rangeControls) {
      const count = segmentCountForWidth(control.track.getBoundingClientRect().width);
      if (!count) continue;
      if (count !== control.segmentElements.length) {
        control.segmentElements = Array.from({ length: count }, () => {
          const segment = document.createElement('span');
          segment.className = 'segment';
          return segment;
        });
        control.segments.replaceChildren(...control.segmentElements);
      }
      this._paintRange(control);
    }
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
      section.append(this._range('brightness', 'bri', brightness, 0, 100, 1, (value) => {
        this._callService(
          'light',
          value === 0 ? 'turn_off' : 'turn_on',
          value === 0 ? {} : { brightness_pct: value }
        );
      }, unavailable));
    }
    if (supportsHue) {
      const hue = percentage(attributes.hs_color?.[0], 360);
      section.append(this._range('hue', 'hue', hue, 0, 360, 1, (value) => {
        const saturation = percentage(attributes.hs_color?.[1] || 100);
        this._callService('light', 'turn_on', { hs_color: [value, saturation] });
      }, unavailable, '°'));
    }
    if (supportsTemperature) {
      const bounds = lightTemperatureBounds(attributes);
      const temperature = lightColorTemperature(attributes, bounds);
      section.append(this._range(
        'temperature',
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
        'position',
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

  _alarmControls(entity, _attributes, unavailable) {
    const section = this._section('alarm controls');
    const {
      state,
      hasDefaultCode,
      codeFormat,
      canDisarm,
      needsArmCode,
      needsDisarmCode,
      showCode,
      modes,
    } = alarmControlModel(entity, this._hass, this._entityId);
    if (!showCode && (this._alarmInput || this._alarmCode)) {
      if (this._alarmInput) this._alarmInput.value = '';
      this._alarmCode = '';
      this._alarmError = '';
    }

    if (showCode) {
      const row = document.createElement('div');
      row.className = 'alarm-code';
      const label = document.createElement('label');
      label.htmlFor = 'terminal-alarm-code';
      label.textContent = codeFormat === 'number' ? 'pin' : 'code';
      const input = document.createElement('input');
      input.id = 'terminal-alarm-code';
      input.type = 'password';
      input.autocomplete = 'off';
      input.disabled = unavailable || this._alarmBusy;
      input.dataset.focusKey = 'alarm-code';
      input.setAttribute('aria-label', `alarm ${label.textContent}`);
      if (codeFormat === 'number') {
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
      }
      input.value = this._alarmCode;
      input.addEventListener('input', () => {
        const value = sanitizeAlarmCode(input.value, codeFormat);
        if (value !== input.value) input.value = value;
        this._alarmCode = value;
        this._alarmError = '';
      });
      row.append(label, input);
      section.append(row);
      this._alarmInput = input;
    } else {
      this._alarmInput = null;
    }

    const buttons = [];
    if (canDisarm) {
      const button = this._actionButton(
        'disarm',
        'mdi:shield-off-outline',
        () => this._callAlarmService('alarm_disarm', needsDisarmCode && !hasDefaultCode),
        unavailable || this._alarmBusy
      );
      button.dataset.focusKey = 'action:alarm_disarm';
      buttons.push(button);
    }
    for (const { popupLabel, icon, service, targetState } of modes) {
      const button = this._actionButton(
        popupLabel,
        icon,
        () => this._callAlarmService(service, needsArmCode && !hasDefaultCode),
        unavailable || this._alarmBusy || state === targetState
      );
      button.dataset.focusKey = `action:${service}`;
      buttons.push(button);
    }
    if (buttons.length) {
      const actions = this._actions(buttons);
      actions.classList.add('alarm-actions');
      section.append(actions);
    }

    const error = document.createElement('div');
    error.className = 'alarm-error';
    error.setAttribute('role', 'status');
    error.setAttribute('aria-live', 'polite');
    error.textContent = this._alarmError;
    section.append(error);
    return section;
  }

  async _callAlarmService(service, requiresCode) {
    if (!this._hass || !this._entityId || this._alarmBusy) return;
    const defaultCode = alarmDefaultCode(this._hass, this._entityId);
    if (requiresCode && !this._alarmCode && !defaultCode) {
      this._alarmError = 'code required';
      this._render();
      this._restoreFocusKey('alarm-code');
      return;
    }
    const hass = this._hass;
    const connection = hass.connection;
    const entityId = this._entityId;
    const generation = ++this._alarmOperationGeneration;
    const code = defaultCode || this._alarmCode;
    const focusKey = this._captureFocusKey();
    this._alarmBusy = true;
    this._alarmError = '';
    this._render();
    this._dialog.focus();
    try {
      await hass.callService(
        'alarm_control_panel',
        service,
        code ? { code } : {},
        { entity_id: entityId }
      );
      if (
        generation !== this._alarmOperationGeneration ||
        this._hass?.connection !== connection ||
        this._entityId !== entityId
      ) return;
      if (this._alarmInput) this._alarmInput.value = '';
      this._alarmCode = '';
      this._alarmBusy = false;
      this._render();
      this._restoreFocusKey(focusKey);
    } catch (error) {
      if (
        generation !== this._alarmOperationGeneration ||
        this._hass?.connection !== connection ||
        this._entityId !== entityId
      ) return;
      this._alarmBusy = false;
      this._alarmError = String(error?.message || 'command failed').toLocaleLowerCase();
      this._render();
      this._restoreFocusKey('alarm-code');
    }
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
    if (this.shadowRoot.activeElement === this._dialog) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && this.shadowRoot.activeElement === first) {
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
