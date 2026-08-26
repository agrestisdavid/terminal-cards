/**
 * terminal-card — Herdr-Pane-Look als Lovelace-Button-Card
 * ------------------------------------------------------------------
 * Look: 1px-Rahmen mit quadratischen Ecken, monospace-Title in der
 * oberen Rahmenlinie (linksbündig, wie ein geteiltes Herdr-Pane).
 * Rahmen/Title/Icon ändern die Farbe mit dem Entity-State:
 *   on = accent (bold), off = dim, unavailable = error.
 * Farben kommen aus dem aktiven HA-Theme (CSS-Variablen),
 * Fallbacks = Catppuccin Mocha (Herdr-Default).
 *
 * Konfiguration:
 *   type: custom:terminal-card
 *   title:  Pflicht — Label in der Rahmenlinie
 *   entity: optional — Klick = homeassistant.toggle
 *   url:    optional — Klick = Navigation (entity hat Vorrang)
 *   icon:   optional — Default: Entity-Icon
 *   name:   optional — Default: friendly_name
 *
 * Installation:
 *   1. Als Dashboard-Resource registrieren (resource_type: module),
 *      z. B. inline per MCP-Tool oder als Datei /local/terminal-card.js.
 *   2. Card in die Dashboard-Config legen (siehe PLAN.md).
 */
(function () {
  'use strict';

  if (customElements.get('terminal-card')) {
    return;
  }

  const CSS = `
    :host {
      display: block;
    }
    .pane {
      position: relative;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 72px;
      padding: 12px 16px;
      border: 1px solid var(--secondary-text-color, #6c7086);
      background: var(--card-background-color, #181825);
      color: var(--primary-text-color, #cdd6f4);
      font-family: ui-monospace, "Cascadia Code", "JetBrains Mono",
        "Fira Code", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.4;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: border-color 120ms ease;
    }
    .pane[data-state="on"] {
      border-color: var(--accent-color, #89b4fa);
    }
    .pane[data-state="off"]:hover {
      border-color: var(--accent-color, #89b4fa);
    }
    .pane[data-state="unavailable"] {
      border-color: var(--error-color, #f38ba8);
    }
    /* Title sitzt IN der oberen Rahmenlinie: Hintergrund überdeckt
       die Rahmenlinie hinter dem Text („aufgeschnittene" Linie). */
    .title {
      position: absolute;
      top: 0;
      left: 12px;
      transform: translateY(-50%);
      padding: 0 8px;
      max-width: calc(100% - 24px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: var(--card-background-color, #181825);
      color: var(--secondary-text-color, #6c7086);
      font-size: 12px;
      line-height: 1.4;
      pointer-events: none;
    }
    .pane[data-state="on"] .title {
      color: var(--accent-color, #89b4fa);
      font-weight: 700;
    }
    .icon {
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      color: var(--secondary-text-color, #6c7086);
      pointer-events: none;
    }
    .pane[data-state="on"] .icon {
      color: var(--accent-color, #89b4fa);
    }
    .pane[data-state="unavailable"] .icon {
      color: var(--error-color, #f38ba8);
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      pointer-events: none;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .state {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--secondary-text-color, #6c7086);
      font-size: 12px;
    }
  `;

  class TerminalCard extends HTMLElement {
    /** Höhe für Masonry/Sections-Layouts. */
    static getCardHeight() {
      return 72;
    }

    setConfig(config) {
      if (!config || !config.title) {
        throw new Error('terminal-card: "title" ist required');
      }
      if (!config.entity && !config.url) {
        throw new Error(
          'terminal-card: entweder "entity" (Toggle) oder "url" (Navigation) ist required'
        );
      }
      this._config = config;
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    connectedCallback() {
      if (!this.shadowRoot) {
        const root = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = CSS;
        const container = document.createElement('div');
        root.appendChild(style);
        root.appendChild(container);
        this._container = container;
      }
    }

    disconnectedCallback() {
      this._hass = null;
    }

    _entity() {
      if (!this._config.entity || !this._hass) {
        return null;
      }
      return this._hass.states[this._config.entity] || null;
    }

    /** on | off | unavailable (entspricht Herdr: fokussiert/inaktiv/blockiert) */
    _dataState() {
      if (!this._config.entity) {
        return 'off';
      }
      const ent = this._entity();
      if (!ent || ent.state === 'unavailable' || ent.state === 'unknown') {
        return 'unavailable';
      }
      return ent.state === 'on' ? 'on' : 'off';
    }

    _render() {
      if (!this._config || !this._hass || !this._container) {
        return;
      }
      const cfg = this._config;
      const ent = this._entity();
      this._container.innerHTML = '';

      const pane = document.createElement('div');
      pane.className = 'pane';
      pane.dataset.state = this._dataState();

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = cfg.title;

      const icon = document.createElement('ha-icon');
      icon.className = 'icon';
      icon.icon =
        cfg.icon ||
        (ent && ent.attributes && ent.attributes.icon) ||
        (cfg.entity ? 'mdi:circle-outline' : 'mdi:open-in-new');

      const text = document.createElement('div');
      text.className = 'text';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent =
        cfg.name ||
        (ent && ent.attributes && ent.attributes.friendly_name) ||
        cfg.title;
      text.appendChild(name);

      if (ent && this._dataState() !== 'unavailable') {
        const state = document.createElement('div');
        state.className = 'state';
        state.textContent = ent.state;
        text.appendChild(state);
      }

      pane.appendChild(title);
      pane.appendChild(icon);
      pane.appendChild(text);
      pane.addEventListener('click', () => this._tap());
      this._container.appendChild(pane);
    }

    _tap() {
      if (!this._hass) {
        return;
      }
      const cfg = this._config;
      if (cfg.entity) {
        this._hass.callService('homeassistant', 'toggle', {
          entity_id: cfg.entity,
        });
      } else if (cfg.url) {
        window.history.pushState(null, '', cfg.url);
        window.dispatchEvent(new CustomEvent('location-changed'));
      }
    }
  }

  customElements.define('terminal-card', TerminalCard);
})();
