import { appearanceSchema, applyAccentColor, validateAppearance } from './appearance.js';
import { executeAction } from './ha.js';
import {
  closeTerminalEntityPopup,
  updateTerminalEntityPopup,
} from './popup.js';
import {
  TERMINAL_COLORS,
  TERMINAL_ENTITY_ALIGNMENT,
  TERMINAL_FONT,
} from './styles.js';

const ACTIONS = ['toggle', 'more-info', 'navigate', 'url', 'perform-action', 'none'];

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
  .card[data-active="true"] { border-color: var(--terminal-accent); }
  .card[data-state="unavailable"] { border-color: var(--terminal-error); }
  .card:not([data-state="unavailable"]):hover { border-color: var(--terminal-accent); }
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
    cursor: pointer;
    outline: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .main:focus-visible {
    outline: 1px solid var(--terminal-accent);
    outline-offset: -3px;
  }
  .icon {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    color: var(--terminal-dim);
    pointer-events: none;
  }
  .card[data-active="true"] .icon { color: var(--terminal-accent); }
  .card[data-state="unavailable"] .icon { color: var(--terminal-error); }
  .text { flex: 1 1 auto; min-width: 0; pointer-events: none; }
  .name, .state {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name { font-weight: 600; }
  .state { color: var(--terminal-dim); font-size: 12px; }
  .state[hidden] { display: none; }
  .card[data-state="unavailable"] .state { color: var(--terminal-error); }
  ${TERMINAL_ENTITY_ALIGNMENT}
`;

export class TerminalEntityCard extends HTMLElement {
  static cardName = 'terminal-entity-card';
  static entityDomains = [];
  static entityLabel = 'Entity';
  static defaultIcon = 'mdi:help-circle-outline';
  static defaultTapAction = { action: 'more-info' };
  static defaultHoldAction = { action: 'none' };

  static isActive(_entity) {
    return false;
  }

  static iconForEntity(_entity) {
    return this.defaultIcon;
  }

  static formatState(hass, entity) {
    return String(hass?.formatEntityState?.(entity) || entity.state).toLocaleLowerCase();
  }

  static getConfigForm() {
    const domains = this.entityDomains;
    const domain = domains.length === 1 ? domains[0] : domains;
    const labels = {
      entity: this.entityLabel,
      name: 'Name',
      icon: 'Icon',
      show_state: 'Show state',
      accent_color: 'Accent color',
      popup_title: 'Popup border title',
      tap_action: 'Tap action',
      hold_action: 'Hold action',
    };
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { domain } } },
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
        { name: 'show_state', default: true, selector: { boolean: {} } },
        {
          type: 'expandable',
          name: '',
          title: 'Appearance',
          flatten: true,
          schema: appearanceSchema({ popupTitle: true }),
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
                  actions: ACTIONS,
                  default_action: this.defaultTapAction.action,
                },
              },
            },
            {
              name: 'hold_action',
              selector: {
                ui_action: {
                  actions: ACTIONS,
                  default_action: this.defaultHoldAction.action,
                },
              },
            },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) => {
        if (schema.name === 'popup_title') {
          return 'Overrides the default “more-info” title embedded in the popup border.';
        }
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    const candidates = [...entities, ...Object.keys(hass?.states || {})];
    const entity = candidates.find((entityId) =>
      this.entityDomains.some((domain) => entityId.startsWith(`${domain}.`))
    ) || '';
    return { entity, show_state: true };
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
    this._main.append(this._icon, this._text);
    this._card.append(this._main);
    root.append(style, this._card);

    this._main.addEventListener('click', () => this._tap());
    this._main.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this._tap();
      } else if (event.key === ' ' && !event.repeat) {
        event.preventDefault();
        this._startHold();
      }
    });
    this._main.addEventListener('keyup', (event) => {
      if (event.key !== ' ') return;
      event.preventDefault();
      this._cancelHold();
      this._tap();
    });
    this._main.addEventListener('pointerdown', () => this._startHold());
    for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
      this._main.addEventListener(eventName, () => this._cancelHold());
    }
  }

  disconnectedCallback() {
    this._cancelHold();
    closeTerminalEntityPopup(this);
    this._hass = null;
  }

  setConfig(config) {
    closeTerminalEntityPopup(this);
    const Card = this.constructor;
    if (!config?.entity || typeof config.entity !== 'string') {
      throw new Error(`${Card.cardName}: "entity" is required`);
    }
    if (!Card.entityDomains.some((domain) => config.entity.startsWith(`${domain}.`))) {
      throw new Error(
        `${Card.cardName}: "entity" must use ${Card.entityDomains.join(' or ')}`
      );
    }
    validateAppearance(config, Card.cardName, { popupTitle: true });
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    updateTerminalEntityPopup(hass);
    this._render();
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: 'auto', min_columns: 3 };
  }

  _entity() {
    return this._hass?.states?.[this._config?.entity] || null;
  }

  _render() {
    if (!this._config) return;
    const Card = this.constructor;
    const entity = this._entity();
    const unavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown';
    const state = unavailable ? 'unavailable' : entity.state;
    const name = this._config.name || entity?.attributes?.friendly_name || this._config.entity;
    const formattedState = unavailable
      ? 'unavailable'
      : Card.formatState(this._hass, entity);
    applyAccentColor(this, this._config.accent_color);
    this._card.dataset.state = state;
    this._card.dataset.active = String(!unavailable && Card.isActive(entity));
    this._card.setAttribute('aria-label', `${name}: ${formattedState}`);
    this._name.textContent = name;
    this._state.hidden = this._config.show_state === false;
    this._state.textContent = formattedState;
    this._icon.icon = this._config.icon || entity?.attributes?.icon || Card.iconForEntity(entity);
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
      this._config.tap_action || this.constructor.defaultTapAction
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
          this._config.hold_action || this.constructor.defaultHoldAction
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
}
