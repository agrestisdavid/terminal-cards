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

/**
 * terminal-card-wrapper — Herdr-Pane für beliebige Lovelace-Child-Cards
 *
 * YAML-Beispiel:
 *   type: custom:terminal-card-wrapper
 *   title: Klima
 *   columns: 2                 # optional; ohne columns vertikale Liste
 *   cards:
 *     - type: entity
 *       entity: sensor.wohnzimmer_temperatur
 *     - type: button
 *       entity: switch.ventilator
 */
(function () {
  'use strict';

  if (customElements.get('terminal-card-wrapper')) {
    return;
  }

  const CSS = `
    :host {
      display: block;
    }
    .pane {
      position: relative;
      box-sizing: border-box;
      min-width: 0;
      margin-top: 8px;
      padding: 18px 12px 12px;
      border: 1px solid var(--secondary-text-color, #6c7086);
      border-radius: 0;
      background: var(--card-background-color, #181825);
      color: var(--primary-text-color, #cdd6f4);
      font-family: ui-monospace, "Cascadia Code", "JetBrains Mono",
        "Fira Code", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.4;
      transition: border-color 120ms ease;
    }
    .pane:focus-within {
      border-color: var(--accent-color, #89b4fa);
    }
    /* Der eigene Pane-Hintergrund überdeckt die Rahmenlinie hinter
       dem Titel und erzeugt so Herdrs „aufgeschnittene" Linie. */
    .title {
      position: absolute;
      top: 0;
      left: 12px;
      box-sizing: border-box;
      transform: translateY(-50%);
      max-width: calc(100% - 24px);
      padding: 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: var(--card-background-color, #181825);
      color: var(--secondary-text-color, #6c7086);
      font-family: inherit;
      font-size: 12px;
      line-height: 1.4;
      pointer-events: none;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .cards[data-layout="grid"] {
      display: grid;
      grid-template-columns: repeat(var(--terminal-wrapper-columns), minmax(0, 1fr));
    }
    .cards > * {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
    }
    .error {
      color: var(--error-color, #f38ba8);
      overflow-wrap: anywhere;
    }
  `;

  class TerminalCardWrapper extends HTMLElement {
    constructor() {
      super();
      this._config = null;
      this._hass = null;
      this._cards = [];
      this._generation = 0;
      this._creationPromise = null;
      this._hasConnected = false;
      this._needsRebuild = false;

      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = CSS;

      this._pane = document.createElement('section');
      this._pane.className = 'pane';

      this._title = document.createElement('div');
      this._title.className = 'title';

      this._cardContainer = document.createElement('div');
      this._cardContainer.className = 'cards';

      this._pane.append(this._title, this._cardContainer);
      root.append(style, this._pane);
    }

    setConfig(config) {
      if (!config || typeof config.title !== 'string' || !config.title.trim()) {
        throw new Error('terminal-card-wrapper: "title" ist required');
      }
      if (!Array.isArray(config.cards)) {
        throw new Error('terminal-card-wrapper: "cards" muss ein Array sein');
      }
      if (
        config.columns !== undefined &&
        (!Number.isInteger(config.columns) || config.columns < 1)
      ) {
        throw new Error(
          'terminal-card-wrapper: "columns" muss eine Ganzzahl >= 1 sein'
        );
      }

      const generation = ++this._generation;
      this._config = config;
      this._cards = [];
      this._creationPromise = null;
      this._title.textContent = config.title;
      this._pane.setAttribute('aria-label', config.title);
      this._cardContainer.replaceChildren();

      if (config.columns === undefined) {
        this._cardContainer.dataset.layout = 'vertical';
        this._cardContainer.style.removeProperty('--terminal-wrapper-columns');
      } else {
        this._cardContainer.dataset.layout = 'grid';
        this._cardContainer.style.setProperty(
          '--terminal-wrapper-columns',
          String(config.columns)
        );
      }

      this._needsRebuild = config.cards.length > 0;
      if (this._needsRebuild && (!this._hasConnected || this.isConnected)) {
        this._startCardCreation(config.cards, generation);
      } else if (!this._needsRebuild) {
        this._requestLayout();
      }
    }

    connectedCallback() {
      this._hasConnected = true;
      if (this._needsRebuild && this._config) {
        this._startCardCreation(this._config.cards, this._generation);
      } else if (this._cards.length) {
        this._requestLayout();
      }
    }

    disconnectedCallback() {
      ++this._generation;
      this._creationPromise = null;
      this._needsRebuild = Boolean(
        this._config && this._config.cards && this._config.cards.length
      );
      this._hass = null;
      this._cards = [];
      this._cardContainer.replaceChildren();
    }

    set hass(hass) {
      this._hass = hass;
      for (const card of this._cards) {
        card.hass = hass;
      }
    }

    getCardSize() {
      const generation = this._generation;
      const creationPromise = this._creationPromise;
      if (creationPromise) {
        return Promise.resolve(creationPromise)
          .catch(() => undefined)
          .then(() =>
            generation === this._generation
              ? this._calculateCardSize()
              : this.getCardSize()
          );
      }
      return this._calculateCardSize();
    }

    getGridOptions() {
      // "auto" ist bereits während der asynchronen Erstellung ein korrekter
      // Größenwert und vermeidet eine versionskritische Promise-Rückgabe hier.
      return { columns: 12, rows: 'auto' };
    }

    _calculateCardSize() {
      const sizes = this._cards.map((card) => {
        try {
          return typeof card.getCardSize === 'function' ? card.getCardSize() : 1;
        } catch (_error) {
          return 1;
        }
      });
      const calculate = (resolvedSizes) => {
        const normalized = resolvedSizes.map((size) =>
          Number.isFinite(Number(size)) ? Math.max(1, Number(size)) : 1
        );
        if (!normalized.length) {
          return 1;
        }
        const columns = this._config && this._config.columns;
        if (!columns) {
          return normalized.reduce((total, size) => total + size, 0);
        }
        let total = 0;
        for (let index = 0; index < normalized.length; index += columns) {
          total += Math.max(...normalized.slice(index, index + columns));
        }
        return total;
      };

      if (sizes.some((size) => size && typeof size.then === 'function')) {
        return Promise.all(
          sizes.map((size) => Promise.resolve(size).catch(() => 1))
        ).then(calculate);
      }
      return calculate(sizes);
    }

    _startCardCreation(cardConfigs, generation) {
      this._needsRebuild = false;
      const creationPromise = this._createCards(cardConfigs, generation);
      this._creationPromise = creationPromise;
      const clearPromise = () => {
        if (this._creationPromise === creationPromise) {
          this._creationPromise = null;
        }
      };
      creationPromise.then(clearPromise, clearPromise);
    }

    async _createCards(cardConfigs, generation) {
      try {
        if (typeof window.loadCardHelpers !== 'function') {
          throw new Error('window.loadCardHelpers ist nicht verfügbar');
        }
        const helpers = await window.loadCardHelpers();
        if (generation !== this._generation) {
          return;
        }

        const cards = await Promise.all(
          cardConfigs.map((cardConfig) =>
            Promise.resolve(helpers.createCardElement(cardConfig))
          )
        );
        if (generation !== this._generation) {
          return;
        }

        this._cards = cards;
        if (this._hass) {
          for (const card of cards) {
            card.hass = this._hass;
          }
        }
        this._cardContainer.replaceChildren(...cards);
        this._requestLayout();
      } catch (error) {
        if (generation !== this._generation) {
          return;
        }
        this._cards = [];
        const message = document.createElement('div');
        message.className = 'error';
        message.textContent = `Child-Cards konnten nicht erstellt werden: ${
          error instanceof Error ? error.message : String(error)
        }`;
        this._cardContainer.replaceChildren(message);
        this._requestLayout();
      }
    }

    _requestLayout() {
      if (this.isConnected) {
        this.dispatchEvent(
          new Event('ll-rebuild', { bubbles: true, composed: true })
        );
      }
    }
  }

  customElements.define('terminal-card-wrapper', TerminalCardWrapper);
})();
