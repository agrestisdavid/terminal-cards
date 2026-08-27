import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import { applyAccentColor, validateAppearance } from '../shared/appearance.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';

const TAG = 'terminal-card-wrapper';

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    display: block;
  }
  .pane {
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    margin-top: 8px;
    padding: 18px 12px 12px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
    font-size: 13px;
    line-height: 1.4;
    --terminal-wrapper-effective-accent: var(
      --terminal-wrapper-accent,
      var(--terminal-accent)
    );
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .pane:hover, .pane:focus-within {
    border-color: var(--terminal-wrapper-effective-accent);
    box-shadow: 0 0 8px color-mix(
      in srgb,
      var(--terminal-wrapper-effective-accent) 45%,
      transparent
    );
  }
  .pane:hover > .title, .pane:focus-within > .title {
    color: var(--terminal-wrapper-effective-accent);
  }
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
    background: var(--terminal-background);
    color: var(--terminal-dim);
    font: 12px/1.4 ${TERMINAL_FONT};
    pointer-events: none;
  }
  .title[data-title-position="right"] {
    right: 12px;
    left: auto;
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
    align-items: stretch;
  }
  .cards > * {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
  }
  .cards[data-layout="grid"] > * {
    align-self: stretch;
    height: 100%;
  }
  .error {
    color: var(--terminal-error);
    overflow-wrap: anywhere;
  }
`;

export class TerminalCardWrapper extends HTMLElement {
  static getConfigElement() {
    return document.createElement('terminal-card-wrapper-editor');
  }

  static getStubConfig() {
    return { title: 'terminal group', cards: [] };
  }

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
    style.textContent = STYLES;
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
      throw new Error('terminal-card-wrapper: "title" is required');
    }
    if (!Array.isArray(config.cards)) {
      throw new Error('terminal-card-wrapper: "cards" must be an array');
    }
    if (
      config.columns !== undefined &&
      (!Number.isInteger(config.columns) || config.columns < 1)
    ) {
      throw new Error('terminal-card-wrapper: "columns" must be an integer >= 1');
    }
    validateAppearance(config, 'terminal-card-wrapper', { titlePosition: true });

    const generation = ++this._generation;
    this._config = { ...config, cards: [...config.cards] };
    this._cards = [];
    this._creationPromise = null;
    this._title.textContent = config.title;
    this._title.dataset.titlePosition = config.title_position || 'left';
    applyAccentColor(this._pane, config.accent_color, '--terminal-wrapper-accent');
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
    }
  }

  connectedCallback() {
    this._hasConnected = true;
    if (this._needsRebuild && this._config) {
      this._startCardCreation(this._config.cards, this._generation);
    }
  }

  disconnectedCallback() {
    ++this._generation;
    this._creationPromise = null;
    this._needsRebuild = Boolean(this._config?.cards?.length);
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
      if (!normalized.length) return 1;
      const columns = this._config?.columns;
      if (!columns) return normalized.reduce((total, size) => total + size, 0);
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
        throw new Error('window.loadCardHelpers is unavailable');
      }
      const helpers = await window.loadCardHelpers();
      if (generation !== this._generation) return;

      const cards = await Promise.all(
        cardConfigs.map((cardConfig) =>
          Promise.resolve(helpers.createCardElement(cardConfig))
        )
      );
      if (generation !== this._generation) return;

      this._cards = cards;
      if (this._hass) {
        for (const card of cards) card.hass = this._hass;
      }
      this._cardContainer.replaceChildren(...cards);
    } catch (error) {
      if (generation !== this._generation) return;
      this._cards = [];
      const message = document.createElement('div');
      message.className = 'error';
      message.textContent = `Child cards could not be created: ${
        error instanceof Error ? error.message : String(error)
      }`;
      this._cardContainer.replaceChildren(message);
    }
  }
}

defineElement(TAG, TerminalCardWrapper);
registerCard({
  type: TAG,
  name: 'Terminal Card Wrapper',
  description: 'Frames arbitrary cards in a terminal-style pane.',
  documentationURL: DOCUMENTATION_URL,
});
