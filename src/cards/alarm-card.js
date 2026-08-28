import {
  alarmControlModel,
  alarmDefaultCode,
  sanitizeAlarmCode,
} from '../shared/alarm.js';
import {
  appearanceSchema,
  applyAccentColor,
  validateAppearance,
} from '../shared/appearance.js';
import {
  DOCUMENTATION_URL,
  defineElement,
  executeAction,
  registerCard,
} from '../shared/ha.js';
import {
  closeTerminalEntityPopup,
  updateTerminalEntityPopup,
} from '../shared/popup.js';
import {
  TERMINAL_BORDER_TITLE,
  TERMINAL_COLORS,
  TERMINAL_ENTITY_ALIGNMENT,
  TERMINAL_FONT,
  TERMINAL_MAIN_ICON_HOVER,
} from '../shared/styles.js';

const TAG = 'terminal-alarm-card';
const DEFAULT_MORE_ICON = 'mdi:shield-key-outline';
const DEFAULT_TAP_ACTION = { action: 'more-info' };
const DEFAULT_HOLD_ACTION = { action: 'none' };
const ACTIONS = ['more-info', 'navigate', 'url', 'perform-action', 'none'];

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    box-sizing: border-box;
    container-type: inline-size;
    display: block;
    height: 100%;
  }
  :host([data-border-title="true"]) { padding-top: 8px; }
  .card {
    position: relative;
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
    overflow: visible;
    transition: border-color 120ms ease;
  }
  .card:not([data-state="disarmed"]):not([data-state="unavailable"]):not([data-state="triggered"]) {
    border-color: var(--terminal-accent);
  }
  .card[data-state="unavailable"],
  .card[data-state="triggered"] { border-color: var(--terminal-error); }
  .card:not([data-state="unavailable"]):not([data-state="triggered"]):hover {
    border-color: var(--terminal-accent);
  }
  .card:not([data-state="unavailable"]):hover .icon,
  .card:not([data-state="unavailable"]):hover .name { color: var(--terminal-accent); }
  .main {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 14px;
    min-width: 0;
    min-height: 72px;
    padding: 12px 14px;
  }
  .main-target {
    align-self: stretch;
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 14px;
    min-width: 0;
    cursor: pointer;
    outline: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .main-target:focus-visible {
    outline: 1px solid var(--terminal-accent);
    outline-offset: 3px;
  }
  .main-target[aria-disabled="true"],
  .main-target[data-interactive="false"] { cursor: default; }
  .icon {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    color: var(--terminal-dim);
    pointer-events: none;
  }
  .card:not([data-state="disarmed"]):not([data-state="unavailable"]) .icon {
    color: var(--terminal-accent);
  }
  .card[data-state="unavailable"] .icon,
  .card[data-state="triggered"] .icon { color: var(--terminal-error); }
  .text { flex: 1 1 auto; min-width: 0; pointer-events: none; }
  .name, .state {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name { font-weight: 600; }
  .state { color: var(--terminal-dim); font-size: 12px; }
  .state[hidden] { display: none; }
  .card[data-state="unavailable"] .state,
  .card[data-state="triggered"] .state { color: var(--terminal-error); }
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
  .expand:disabled { cursor: default; opacity: .55; }
  .expand ha-icon {
    width: 20px;
    height: 20px;
    --mdc-icon-size: 20px;
  }
  .controls {
    display: grid;
    gap: 10px;
    margin-top: auto;
    padding: 0 14px 12px;
  }
  .controls[hidden] { display: none; }
  .alarm-code {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
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
    border-color: var(--terminal-accent);
    outline: none;
  }
  .alarm-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .alarm-action {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    min-width: 0;
    min-height: 34px;
    padding: 0 8px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    font: 11px ${TERMINAL_FONT};
    cursor: pointer;
  }
  .alarm-action:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .alarm-action:hover, .alarm-action:focus-visible {
    border-color: var(--terminal-accent);
    color: var(--terminal-accent);
    outline: none;
  }
  .alarm-action:disabled { cursor: default; opacity: .55; }
  .alarm-action ha-icon {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    --mdc-icon-size: 18px;
  }
  .alarm-action span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .alarm-error {
    color: var(--terminal-error);
    font-size: 11px;
  }
  .alarm-error[data-empty="true"] { display: none; }
  @container (max-width: 260px) {
    .main {
      gap: 10px;
      padding-inline: 10px;
    }
    .main-target { gap: 10px; }
    .controls { padding-inline: 10px; }
  }
  ${TERMINAL_BORDER_TITLE}
  ${TERMINAL_ENTITY_ALIGNMENT}
  ${TERMINAL_MAIN_ICON_HOVER}
`;

export class TerminalAlarmCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      entity: 'Alarm entity',
      name: 'Name',
      icon: 'Icon',
      show_state: 'Show state',
      show_controls: 'Show controls button',
      controls_expanded: 'Expand controls by default',
      accent_color: 'Accent color',
      more_icon: 'Controls icon',
      popup_title: 'Popup border title',
      border_title: 'Border title',
      title_position: 'Border title position',
      tap_action: 'Tap action',
      hold_action: 'Hold action',
    };
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { domain: 'alarm_control_panel' } } },
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
            { name: 'controls_expanded', default: false, selector: { boolean: {} } },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Appearance',
          flatten: true,
          schema: appearanceSchema({
            moreIcon: true,
            popupTitle: true,
            borderTitle: true,
            titlePosition: true,
          }),
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
                ui_action: { actions: ACTIONS, default_action: 'more-info' },
              },
            },
            {
              name: 'hold_action',
              selector: {
                ui_action: { actions: ACTIONS, default_action: 'none' },
              },
            },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) => {
        if (schema.name === 'show_controls') {
          return 'Shows only arm modes advertised by the entity, plus Disarm when applicable.';
        }
        if (schema.name === 'popup_title') {
          return 'Overrides the default “more-info” title embedded in the popup border.';
        }
        if (schema.name === 'border_title') {
          return 'Optional label embedded in the upper border; the alarm name remains inside the card.';
        }
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    const candidates = [...entities, ...Object.keys(hass?.states || {})];
    const entity = candidates.find((entityId) =>
      entityId.startsWith('alarm_control_panel.')
    ) || '';
    return {
      entity,
      show_state: true,
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
    this._alarmCode = '';
    this._alarmError = '';
    this._alarmBusy = false;
    this._alarmOperationGeneration = 0;
    this._alarmInput = null;
    this._alarmErrorElement = null;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._card = document.createElement('article');
    this._card.className = 'card';
    this._borderTitle = document.createElement('div');
    this._borderTitle.className = 'border-title';
    this._borderTitle.hidden = true;
    this._main = document.createElement('div');
    this._main.className = 'main';
    this._mainTarget = document.createElement('div');
    this._mainTarget.className = 'main-target';
    this._mainTarget.tabIndex = 0;
    this._mainTarget.dataset.focusKey = 'main';
    this._mainTarget.setAttribute('role', 'button');
    this._icon = document.createElement('ha-icon');
    this._icon.className = 'icon';
    this._text = document.createElement('div');
    this._text.className = 'text';
    this._name = document.createElement('div');
    this._name.className = 'name';
    this._state = document.createElement('div');
    this._state.className = 'state';
    this._text.append(this._name, this._state);
    this._mainTarget.append(this._icon, this._text);
    this._expand = document.createElement('button');
    this._expand.className = 'expand';
    this._expand.type = 'button';
    this._expand.dataset.focusKey = 'expand';
    this._expand.title = 'Toggle alarm controls';
    this._expand.setAttribute('aria-label', 'Toggle alarm controls');
    this._expand.setAttribute('aria-controls', 'terminal-alarm-controls');
    this._expandIcon = document.createElement('ha-icon');
    this._expandIcon.icon = DEFAULT_MORE_ICON;
    this._expand.append(this._expandIcon);
    this._main.append(this._mainTarget, this._expand);
    this._controls = document.createElement('div');
    this._controls.id = 'terminal-alarm-controls';
    this._controls.className = 'controls';
    this._card.append(this._borderTitle, this._main, this._controls);
    root.append(style, this._card);

    this._mainTarget.addEventListener('click', () => this._tap());
    this._mainTarget.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this._tap();
      } else if (event.key === ' ' && !event.repeat) {
        event.preventDefault();
        this._startHold();
      }
    });
    this._mainTarget.addEventListener('keyup', (event) => {
      if (event.key !== ' ') return;
      event.preventDefault();
      this._cancelHold();
      this._tap();
    });
    this._mainTarget.addEventListener('pointerdown', () => this._startHold());
    for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
      this._mainTarget.addEventListener(eventName, () => this._cancelHold());
    }
    this._expand.addEventListener('click', () => {
      if (this._alarmBusy) return;
      this._setControlsExpanded(!this._controlsExpanded);
    });
  }

  disconnectedCallback() {
    this._cancelHold();
    closeTerminalEntityPopup(this);
    this._clearAlarmSession(false);
    this._hass = null;
  }

  setConfig(config) {
    closeTerminalEntityPopup(this);
    this._clearAlarmSession(false);
    if (!config?.entity || typeof config.entity !== 'string') {
      throw new Error('terminal-alarm-card: "entity" is required');
    }
    if (!config.entity.startsWith('alarm_control_panel.')) {
      throw new Error('terminal-alarm-card: "entity" must be an alarm_control_panel');
    }
    validateAppearance(config, TAG, {
      moreIcon: true,
      popupTitle: true,
      borderTitle: true,
      titlePosition: true,
    });
    const previousDefault = this._config?.controls_expanded;
    const previousEntity = this._config?.entity;
    this._config = { ...config };
    if (previousDefault !== config.controls_expanded || previousEntity !== config.entity) {
      this._controlsExpanded = config.controls_expanded === true;
    }
    this._render();
  }

  set hass(hass) {
    const focusKey = this._captureFocusKey();
    const connectionChanged = Boolean(
      this._hass && this._hass.connection !== hass?.connection
    );
    if (connectionChanged) this._clearAlarmSession(false);
    this._hass = hass;
    updateTerminalEntityPopup(hass);
    this._render();
    this._restoreFocusKey(focusKey);
  }

  getCardSize() {
    if (!this._controlsExpanded || this._config?.show_controls === false) return 1;
    const model = alarmControlModel(this._entity(), this._hass, this._config?.entity);
    const actionRows = Math.ceil((model.modes.length + Number(model.canDisarm)) / 2);
    const rowCount = actionRows + Number(model.showCode) + Number(Boolean(this._alarmError));
    return 1 + Math.max(1, Math.ceil(rowCount / 2));
  }

  getGridOptions() {
    return { columns: 6, rows: 'auto', min_columns: 3 };
  }

  _entity() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _dataState() {
    const entity = this._entity();
    if (!entity || ['unavailable', 'unknown'].includes(entity.state)) {
      return 'unavailable';
    }
    return entity.state;
  }

  _render() {
    if (!this._config) return;
    applyAccentColor(this, this._config.accent_color);
    const entity = this._entity();
    const attributes = entity?.attributes || {};
    const state = this._dataState();
    const unavailable = state === 'unavailable';
    const name = this._config.name || attributes.friendly_name || this._config.entity;
    const formattedState = entity
      ? this._hass?.formatEntityState?.(entity) || entity.state
      : 'unavailable';
    const borderTitle = this._config.border_title?.trim() || '';

    this.dataset.borderTitle = String(Boolean(borderTitle));
    this._borderTitle.hidden = !borderTitle;
    this._borderTitle.dataset.titlePosition = this._config.title_position || 'left';
    this._borderTitle.textContent = borderTitle;
    this._card.dataset.state = state;
    this._card.setAttribute('aria-label', `${name}: ${formattedState}`);
    const tapAction = this._config.tap_action || DEFAULT_TAP_ACTION;
    const holdAction = this._config.hold_action || DEFAULT_HOLD_ACTION;
    const primaryAction = tapAction.action !== 'none' ? tapAction : holdAction;
    const interactive = primaryAction.action !== 'none';
    this._mainTarget.dataset.interactive = String(interactive);
    this._mainTarget.tabIndex = interactive ? 0 : -1;
    if (interactive) {
      this._mainTarget.setAttribute('role', 'button');
      this._mainTarget.setAttribute('aria-label', this._actionLabel(primaryAction, name));
    } else {
      this._mainTarget.removeAttribute('role');
      this._mainTarget.removeAttribute('aria-label');
    }
    if (primaryAction.action === 'more-info') {
      this._mainTarget.setAttribute('aria-haspopup', 'dialog');
    } else {
      this._mainTarget.removeAttribute('aria-haspopup');
    }
    this._mainTarget.setAttribute('aria-disabled', this._alarmBusy ? 'true' : 'false');
    this._icon.icon = this._config.icon || attributes.icon || this._stateIcon(state);
    this._name.textContent = name;
    this._state.hidden = this._config.show_state === false;
    this._state.textContent = String(formattedState).toLocaleLowerCase();
    this._expandIcon.icon = this._config.more_icon || DEFAULT_MORE_ICON;

    const model = alarmControlModel(entity, this._hass, this._config.entity);
    if (!model.showCode && (this._alarmInput || this._alarmCode)) {
      if (this._alarmInput) this._alarmInput.value = '';
      this._alarmCode = '';
      this._alarmError = '';
    }
    const hasControls = model.canDisarm || model.modes.length > 0;
    const controlsHidden = this._config.show_controls === false || !hasControls;
    const expanded = this._controlsExpanded && !controlsHidden;
    if (!expanded && (
      this._alarmInput || this._alarmCode || this._alarmError || this._alarmBusy
    )) {
      this._clearAlarmSession(false);
    }
    this._mainTarget.setAttribute('aria-disabled', this._alarmBusy ? 'true' : 'false');
    this._expand.hidden = controlsHidden;
    this._expand.disabled = this._alarmBusy;
    this._expand.setAttribute('aria-expanded', String(expanded));
    this._controls.hidden = !expanded;
    this._renderControls(model, unavailable, expanded);
  }

  _renderControls(model, unavailable, expanded) {
    if (this._alarmInput) this._alarmInput.value = '';
    this._controls.replaceChildren();
    this._alarmInput = null;
    this._alarmErrorElement = null;
    if (!expanded) return;

    if (model.showCode) {
      const row = document.createElement('div');
      row.className = 'alarm-code';
      const label = document.createElement('label');
      label.htmlFor = 'terminal-alarm-card-code';
      label.textContent = model.codeFormat === 'number' ? 'pin' : 'code';
      const input = document.createElement('input');
      input.id = 'terminal-alarm-card-code';
      input.type = 'password';
      input.autocomplete = 'off';
      input.disabled = unavailable || this._alarmBusy;
      input.dataset.focusKey = 'alarm-code';
      input.setAttribute('aria-label', `alarm ${label.textContent}`);
      if (model.codeFormat === 'number') {
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
      }
      input.value = this._alarmCode;
      input.addEventListener('input', () => {
        const value = sanitizeAlarmCode(input.value, model.codeFormat);
        if (value !== input.value) input.value = value;
        this._alarmCode = value;
        this._alarmError = '';
        if (this._alarmErrorElement) {
          this._alarmErrorElement.textContent = '';
          this._alarmErrorElement.dataset.empty = 'true';
        }
      });
      row.append(label, input);
      this._controls.append(row);
      this._alarmInput = input;
    }

    const actions = document.createElement('div');
    actions.className = 'alarm-actions';
    for (const mode of model.modes) {
      actions.append(this._alarmActionButton(
        mode.label,
        mode.popupLabel,
        mode.icon,
        mode.service,
        model.needsArmCode && !model.hasDefaultCode,
        unavailable || this._alarmBusy || model.state === mode.targetState
      ));
    }
    if (model.canDisarm) {
      actions.append(this._alarmActionButton(
        'disarm',
        'disarm',
        'mdi:shield-off-outline',
        'alarm_disarm',
        model.needsDisarmCode && !model.hasDefaultCode,
        unavailable || this._alarmBusy
      ));
    }
    if (actions.childElementCount) this._controls.append(actions);

    const error = document.createElement('div');
    error.className = 'alarm-error';
    error.dataset.empty = String(!this._alarmError);
    error.setAttribute('role', 'status');
    error.setAttribute('aria-live', 'polite');
    error.textContent = this._alarmError;
    this._controls.append(error);
    this._alarmErrorElement = error;
  }

  _alarmActionButton(label, accessibleLabel, icon, service, requiresCode, disabled) {
    const button = document.createElement('button');
    button.className = 'alarm-action';
    button.type = 'button';
    button.disabled = disabled;
    button.dataset.focusKey = `action:${service}`;
    button.setAttribute('aria-label', accessibleLabel);
    const iconElement = document.createElement('ha-icon');
    iconElement.icon = icon;
    const text = document.createElement('span');
    text.textContent = label;
    button.append(iconElement, text);
    button.addEventListener('click', () => this._callAlarmService(service, requiresCode));
    return button;
  }

  _actionLabel(action, name) {
    if (action.action === 'more-info') return `Open terminal details for ${name}`;
    if (action.action === 'navigate') return `Navigate from ${name}`;
    if (action.action === 'url') return `Open link for ${name}`;
    if (action.action === 'perform-action' || action.action === 'call-service') {
      return `Run action for ${name}`;
    }
    return name;
  }

  _stateIcon(state) {
    const icons = {
      disarmed: 'mdi:shield-off-outline',
      armed_home: 'mdi:shield-home-outline',
      armed_away: 'mdi:shield-lock-outline',
      armed_night: 'mdi:shield-moon-outline',
      armed_vacation: 'mdi:shield-airplane-outline',
      armed_custom_bypass: 'mdi:shield-half-full',
      triggered: 'mdi:shield-alert-outline',
      arming: 'mdi:shield-sync-outline',
      pending: 'mdi:shield-alert-outline',
      disarming: 'mdi:shield-off-outline',
      unavailable: 'mdi:shield-alert-outline',
    };
    return icons[state] || 'mdi:shield-outline';
  }

  _setControlsExpanded(expanded) {
    if (!expanded) this._clearAlarmSession(false);
    this._controlsExpanded = expanded;
    this._render();
    if (expanded) this._restoreFocusKey('alarm-code');
  }

  _tap() {
    if (!this._hass || !this._config || this._held || this._alarmBusy) {
      this._held = false;
      return;
    }
    const action = this._config.tap_action || DEFAULT_TAP_ACTION;
    if (action.action === 'none') return;
    this._clearAlarmSession(false);
    this._render();
    executeAction(this, this._hass, this._config, action);
  }

  _startHold() {
    this._cancelHold();
    this._held = false;
    this._holdTimer = window.setTimeout(() => {
      this._holdTimer = null;
      this._held = true;
      if (this._hass && this._config && !this._alarmBusy) {
        this._clearAlarmSession(false);
        this._render();
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

  async _callAlarmService(service, requiresCode) {
    if (!this._hass || !this._config || this._alarmBusy) return;
    const defaultCode = alarmDefaultCode(this._hass, this._config.entity);
    if (requiresCode && !this._alarmCode && !defaultCode) {
      this._alarmError = 'code required';
      this._render();
      this._restoreFocusKey('alarm-code');
      return;
    }

    const hass = this._hass;
    const connection = hass.connection;
    const entityId = this._config.entity;
    const generation = ++this._alarmOperationGeneration;
    const code = defaultCode || this._alarmCode;
    const focusKey = `action:${service}`;
    this._alarmBusy = true;
    this._alarmError = '';
    this._render();
    this._mainTarget.focus();
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
        this._config?.entity !== entityId
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
        this._config?.entity !== entityId
      ) return;
      this._alarmBusy = false;
      this._alarmError = String(error?.message || 'command failed').toLocaleLowerCase();
      this._render();
      this._restoreFocusKey(this._alarmInput ? 'alarm-code' : focusKey);
    }
  }

  _clearAlarmSession(render) {
    if (this._alarmInput) this._alarmInput.value = '';
    this._alarmCode = '';
    this._alarmError = '';
    this._alarmBusy = false;
    ++this._alarmOperationGeneration;
    this._alarmInput = null;
    this._alarmErrorElement = null;
    if (render) this._render();
  }

  _captureFocusKey() {
    return this.shadowRoot.activeElement?.dataset?.focusKey || null;
  }

  _restoreFocusKey(key) {
    if (!key) return;
    const target = [...this.shadowRoot.querySelectorAll('[data-focus-key]')]
      .find((element) =>
        element.dataset.focusKey === key && !element.disabled &&
          !element.hidden && !element.closest('[hidden]')
      );
    const fallback = !this._expand.hidden && !this._expand.disabled
      ? this._expand
      : this._mainTarget.tabIndex >= 0
        ? this._mainTarget
        : null;
    (target || fallback)?.focus();
  }
}

defineElement(TAG, TerminalAlarmCard);
registerCard({
  type: TAG,
  name: 'Terminal Alarm Card',
  description: 'A terminal-style alarm control with supported modes and ephemeral PIN entry.',
  documentationURL: DOCUMENTATION_URL,
});
