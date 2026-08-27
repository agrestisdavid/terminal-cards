import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import { applyAccentColor, validateAppearance } from '../shared/appearance.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';

const TAG = 'terminal-card-wrapper';
const STATE_POSITIONS = new Set([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    display: block;
  }
  :host([data-state-edge="bottom"]) { padding-bottom: 8px; }
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
    transition: border-color 120ms ease;
  }
  .pane:hover, .pane:focus-within {
    border-color: var(--terminal-wrapper-effective-accent);
  }
  .pane:hover .border-label, .pane:focus-within .border-label {
    color: var(--terminal-wrapper-effective-accent);
  }
  .border-slot {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    gap: 6px;
    max-width: calc(100% - 24px);
    pointer-events: none;
  }
  .border-slot[data-position="top-left"] {
    top: 0;
    left: 12px;
    transform: translateY(-50%);
  }
  .border-slot[data-position="top-right"] {
    top: 0;
    right: 12px;
    justify-content: flex-end;
    transform: translateY(-50%);
  }
  .border-slot[data-position="bottom-left"] {
    bottom: 0;
    left: 12px;
    transform: translateY(50%);
  }
  .border-slot[data-position="bottom-right"] {
    right: 12px;
    bottom: 0;
    justify-content: flex-end;
    transform: translateY(50%);
  }
  .pane[data-top-split="true"] .border-slot[data-edge="top"] {
    max-width: calc(50% - 15px);
  }
  .border-label {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    padding: 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--terminal-background);
    color: var(--terminal-dim);
    font: 12px/1.4 ${TERMINAL_FONT};
    pointer-events: none;
  }
  .border-slot > .border-label:first-child:nth-last-child(2),
  .border-slot > .border-label:first-child:nth-last-child(2) ~ .border-label {
    max-width: calc(50% - 3px);
  }
  .state { color: var(--terminal-dim); }
  .border-label[hidden] { display: none; }
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
  .cards[data-layout="grid"][data-single-last-row="true"] > :last-child {
    grid-column: 1 / -1;
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
    this._templateValue = undefined;
    this._templateError = null;
    this._templateSubscription = null;
    this._templateConnection = null;
    this._templateText = null;
    this._templateGeneration = 0;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._pane = document.createElement('section');
    this._pane.className = 'pane';
    this._slots = Object.fromEntries(
      [...STATE_POSITIONS].map((position) => {
        const slot = document.createElement('div');
        slot.className = 'border-slot';
        slot.dataset.position = position;
        slot.dataset.edge = position.startsWith('top') ? 'top' : 'bottom';
        return [position, slot];
      })
    );
    this._title = document.createElement('div');
    this._title.className = 'border-label title';
    this._state = document.createElement('div');
    this._state.className = 'border-label state';
    this._state.hidden = true;
    this._cardContainer = document.createElement('div');
    this._cardContainer.className = 'cards';
    this._pane.append(...Object.values(this._slots), this._cardContainer);
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
    if (
      config.entity !== undefined &&
      (typeof config.entity !== 'string' || !config.entity.trim())
    ) {
      throw new Error('terminal-card-wrapper: "entity" must be a non-empty entity id');
    }
    if (
      config.state_template !== undefined &&
      typeof config.state_template !== 'string'
    ) {
      throw new Error('terminal-card-wrapper: "state_template" must be a string');
    }
    if (
      config.state_position !== undefined &&
      !STATE_POSITIONS.has(config.state_position)
    ) {
      throw new Error(
        'terminal-card-wrapper: "state_position" must be top-left, top-right, bottom-left or bottom-right'
      );
    }
    validateAppearance(config, 'terminal-card-wrapper', { titlePosition: true });

    this._teardownTemplateSubscription();
    const generation = ++this._generation;
    this._config = { ...config, cards: [...config.cards] };
    this._cards = [];
    this._creationPromise = null;
    this._templateValue = undefined;
    this._templateError = null;
    this._title.textContent = config.title;
    applyAccentColor(this._pane, config.accent_color, '--terminal-wrapper-accent');
    this._pane.setAttribute('aria-label', config.title);
    this._cardContainer.replaceChildren();
    this._renderBorderLabels();

    if (config.columns === undefined) {
      this._cardContainer.dataset.layout = 'vertical';
      delete this._cardContainer.dataset.singleLastRow;
      this._cardContainer.style.removeProperty('--terminal-wrapper-columns');
    } else {
      this._cardContainer.dataset.layout = 'grid';
      this._cardContainer.dataset.singleLastRow = String(
        config.columns > 1 && config.cards.length % config.columns === 1
      );
      this._cardContainer.style.setProperty(
        '--terminal-wrapper-columns',
        String(config.columns)
      );
    }

    this._needsRebuild = config.cards.length > 0;
    if (this._needsRebuild && (!this._hasConnected || this.isConnected)) {
      this._startCardCreation(config.cards, generation);
    }
    this._ensureTemplateSubscription();
  }

  connectedCallback() {
    this._hasConnected = true;
    if (this._needsRebuild && this._config) {
      this._startCardCreation(this._config.cards, this._generation);
    }
    this._ensureTemplateSubscription();
  }

  disconnectedCallback() {
    ++this._generation;
    this._teardownTemplateSubscription();
    this._creationPromise = null;
    this._needsRebuild = Boolean(this._config?.cards?.length);
    this._hass = null;
    this._cards = [];
    this._cardContainer.replaceChildren();
  }

  set hass(hass) {
    const connectionChanged = this._hass?.connection !== hass?.connection;
    this._hass = hass;
    for (const card of this._cards) {
      card.hass = hass;
    }
    this._renderBorderLabels();
    if (connectionChanged || this._templateSubscription === null) {
      this._ensureTemplateSubscription();
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

  _stateContent() {
    if (this._templateValue !== undefined) return this._templateValue;
    if (this._config?.entity) {
      const entity = this._hass?.states?.[this._config.entity];
      if (!entity) return 'unavailable';
      return String(this._hass?.formatEntityState?.(entity) || entity.state)
        .toLocaleLowerCase();
    }
    return '';
  }

  _renderBorderLabels() {
    if (!this._config) return;
    const titlePosition = this._config.title_position === 'right'
      ? 'top-right'
      : 'top-left';
    const statePosition = this._config.state_position ||
      (titlePosition === 'top-left' ? 'top-right' : 'top-left');
    this._title.dataset.titlePosition = this._config.title_position || 'left';
    this._state.dataset.statePosition = statePosition;
    const stateContent = this._stateContent();
    const showState = Boolean(
      (this._config.entity || this._config.state_template?.trim()) &&
      stateContent !== ''
    );

    this._slots[titlePosition].append(this._title);
    this._state.textContent = stateContent;
    this._state.hidden = !showState;
    if (showState) this._slots[statePosition].append(this._state);
    else this._state.remove();
    this._pane.dataset.topSplit = String(
      showState && titlePosition.startsWith('top') && statePosition.startsWith('top') &&
      titlePosition !== statePosition
    );
    if (showState && statePosition.startsWith('bottom')) {
      this.dataset.stateEdge = 'bottom';
    } else {
      delete this.dataset.stateEdge;
    }
    const ariaState = showState ? `, ${stateContent}` : '';
    this._pane.setAttribute('aria-label', `${this._config.title}${ariaState}`);
  }

  _ensureTemplateSubscription() {
    const template = typeof this._config?.state_template === 'string'
      ? this._config.state_template
      : '';
    const connection = this._hass?.connection;
    if (!this.isConnected || !template.trim() || !connection?.subscribeMessage) return;
    if (
      this._templateSubscription !== null &&
      this._templateConnection === connection &&
      this._templateText === template
    ) {
      return;
    }

    this._teardownTemplateSubscription();
    const generation = ++this._templateGeneration;
    this._templateConnection = connection;
    this._templateText = template;
    const params = {
      type: 'render_template',
      template,
      variables: {
        config: this._config,
        user: this._hass?.user?.name,
      },
      strict: true,
      report_errors: true,
      ...(this._config.entity ? { entity_ids: this._config.entity } : {}),
    };

    try {
      const subscription = connection.subscribeMessage((message) => {
        if (
          generation !== this._templateGeneration ||
          this._templateConnection !== connection ||
          this._templateText !== template
        ) {
          return;
        }
        if (message && typeof message.error === 'string') {
          this._templateError = message;
          return;
        }
        if (message && message.result !== undefined) {
          this._templateValue = String(message.result).toLocaleLowerCase();
          this._templateError = null;
          this._renderBorderLabels();
        }
      }, params);
      this._templateSubscription = Promise.resolve(subscription);
      this._templateSubscription.catch(() => {
        if (generation !== this._templateGeneration) return;
        this._templateError = { error: 'template unavailable', level: 'ERROR' };
        this._templateSubscription = null;
        this._renderBorderLabels();
      });
    } catch (_error) {
      if (generation !== this._templateGeneration) return;
      this._templateError = { error: 'template unavailable', level: 'ERROR' };
      this._templateSubscription = null;
      this._renderBorderLabels();
    }
  }

  _teardownTemplateSubscription() {
    ++this._templateGeneration;
    const subscription = this._templateSubscription;
    this._templateSubscription = null;
    this._templateConnection = null;
    this._templateText = null;
    if (subscription) {
      Promise.resolve(subscription)
        .then((unsubscribe) => {
          if (typeof unsubscribe === 'function') unsubscribe();
        })
        .catch(() => undefined);
    }
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
  description: 'Frames arbitrary cards with optional reactive border state.',
  documentationURL: DOCUMENTATION_URL,
});
