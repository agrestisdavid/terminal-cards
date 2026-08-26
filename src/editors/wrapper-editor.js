import { defineElement, fireConfigChanged } from '../shared/ha.js';
import { EDITOR_STYLES } from '../shared/styles.js';

const TAG = 'terminal-card-wrapper-editor';
const CORE_CARD_TYPES = [
  'tile',
  'button',
  'heading',
  'markdown',
  'entities',
  'area',
  'sensor',
  'gauge',
  'history-graph',
  'statistics-graph',
  'conditional',
  'grid',
  'vertical-stack',
  'horizontal-stack',
];

const STYLES = `
  ${EDITOR_STYLES}
  .toolbar, .tabs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .toolbar { justify-content: space-between; }
  .tabs { flex: 1 1 auto; }
  .tab[aria-selected="true"] { border-color: var(--primary-color); color: var(--primary-color); }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .child-editor {
    margin-top: 8px;
    padding: 12px;
    border: 1px solid var(--divider-color, #6c7086);
  }
  .picker-fallback { display: grid; gap: 12px; }
  .danger { color: var(--error-color); }
`;

export class TerminalCardWrapperEditor extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._lovelace = null;
    this._selected = 0;
    this._guiMode = true;
    this._guiModeAvailable = true;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._container = document.createElement('div');
    root.append(style, this._container);
  }

  set hass(hass) {
    this._hass = hass;
    this._propagateContext();
  }

  get hass() {
    return this._hass;
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    this._propagateContext();
  }

  get lovelace() {
    return this._lovelace;
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.cards)) {
      throw new Error('terminal-card-wrapper editor requires a cards array');
    }
    this._config = { ...config, cards: [...config.cards] };
    this._selected = Math.min(this._selected, this._config.cards.length);
    this._render();
  }

  focusYamlEditor() {
    this._childEditor?.focusYamlEditor?.();
  }

  _propagateContext() {
    if (this._childEditor) {
      this._childEditor.hass = this._hass;
      this._childEditor.lovelace = this._lovelace;
    }
    if (this._picker) {
      this._picker.hass = this._hass;
      this._picker.lovelace = this._lovelace;
    }
  }

  _emit(nextConfig, rerender = false) {
    this._config = nextConfig;
    fireConfigChanged(this, nextConfig);
    if (rerender) this._render();
  }

  _render() {
    if (!this._config) return;
    const cards = this._config.cards;
    const selectedIsCard = this._selected < cards.length;
    this._container.innerHTML = `
      <div class="editor">
        <div class="row">
          <div class="field">
            <label for="title">Border title</label>
            <input id="title" type="text" required />
          </div>
          <div class="field">
            <label for="columns">Columns</label>
            <input id="columns" type="number" min="1" step="1" placeholder="vertical" />
            <span class="hint">Leave empty for a vertical list.</span>
          </div>
        </div>
        <div class="toolbar">
          <div class="tabs" role="tablist" aria-label="Child cards"></div>
          <div class="actions">
            <button type="button" data-action="add">Add card</button>
            ${
              selectedIsCard
                ? `<button type="button" data-action="mode">${
                    this._guiMode ? 'Code editor' : 'Visual editor'
                  }</button>
                   <button type="button" data-action="prev" ${this._selected === 0 ? 'disabled' : ''}>Move left</button>
                   <button type="button" data-action="next" ${this._selected === cards.length - 1 ? 'disabled' : ''}>Move right</button>
                   <button type="button" class="danger" data-action="delete">Remove</button>`
                : ''
            }
          </div>
        </div>
        <div class="child-editor"></div>
      </div>
    `;

    const title = this._container.querySelector('#title');
    title.value = this._config.title || '';
    title.addEventListener('input', (event) => {
      this._emit({ ...this._config, title: event.target.value });
    });

    const columns = this._container.querySelector('#columns');
    columns.value = this._config.columns ?? '';
    columns.addEventListener('change', (event) => {
      const value = event.target.value;
      const next = { ...this._config };
      if (value === '') delete next.columns;
      else next.columns = Math.max(1, Number.parseInt(value, 10) || 1);
      this._emit(next);
    });

    const tabs = this._container.querySelector('.tabs');
    cards.forEach((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(index === this._selected));
      button.textContent = `${index + 1}: ${card.type || 'manual'}`;
      button.addEventListener('click', () => {
        this._selected = index;
        this._guiMode = true;
        this._guiModeAvailable = true;
        this._render();
      });
      tabs.append(button);
    });

    this._container.querySelector('[data-action="add"]').addEventListener('click', () => {
      this._selected = cards.length;
      this._render();
    });
    this._container.querySelector('[data-action="mode"]')?.addEventListener('click', () => {
      if (this._guiModeAvailable) this._childEditor?.toggleMode?.();
    });
    this._container.querySelector('[data-action="prev"]')?.addEventListener('click', () => this._move(-1));
    this._container.querySelector('[data-action="next"]')?.addEventListener('click', () => this._move(1));
    this._container.querySelector('[data-action="delete"]')?.addEventListener('click', () => this._remove());

    const editor = this._container.querySelector('.child-editor');
    if (selectedIsCard) this._renderChildEditor(editor);
    else this._renderPicker(editor);
  }

  _renderChildEditor(container) {
    this._childEditor = document.createElement('hui-card-element-editor');
    this._childEditor.hass = this._hass;
    this._childEditor.lovelace = this._lovelace;
    this._childEditor.value = this._config.cards[this._selected];
    this._childEditor.addEventListener('config-changed', (event) => {
      event.stopPropagation();
      const cards = [...this._config.cards];
      cards[this._selected] = event.detail.config;
      this._guiModeAvailable = event.detail.guiModeAvailable !== false;
      this._emit({ ...this._config, cards });
    });
    this._childEditor.addEventListener('GUImode-changed', (event) => {
      event.stopPropagation();
      this._guiMode = event.detail.guiMode;
      this._guiModeAvailable = event.detail.guiModeAvailable !== false;
      const button = this._container.querySelector('[data-action="mode"]');
      if (button) button.textContent = this._guiMode ? 'Code editor' : 'Visual editor';
    });
    container.append(this._childEditor);
  }

  _renderPicker(container) {
    if (customElements.get('hui-card-picker')) {
      this._picker = document.createElement('hui-card-picker');
      this._picker.hass = this._hass;
      this._picker.lovelace = this._lovelace;
      this._picker.addEventListener('config-changed', (event) => {
        event.stopPropagation();
        this._appendCard(event.detail.config);
      });
      container.append(this._picker);
      return;
    }

    const fallback = document.createElement('div');
    fallback.className = 'picker-fallback';
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = 'Choose a child-card type. Its native visual editor opens next.';
    const select = document.createElement('select');
    const customTypes = (window.customCards || []).map((card) => `custom:${card.type}`);
    for (const type of [...new Set([...CORE_CARD_TYPES, ...customTypes])]) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      select.append(option);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Create child card';
    add.addEventListener('click', () => this._appendCard(this._stubForType(select.value)));
    fallback.append(hint, select, add);
    container.append(fallback);
  }

  _stubForType(type) {
    const firstEntity = Object.keys(this._hass?.states || {})[0] || '';
    const firstLight =
      Object.keys(this._hass?.states || {}).find((entityId) => entityId.startsWith('light.')) || '';
    if (type === 'markdown') return { type, content: '' };
    if (type === 'heading') return { type, heading: 'heading' };
    if (type === 'entities') return { type, entities: [] };
    if (type === 'grid') return { type, columns: 2, square: false, cards: [] };
    if (type === 'vertical-stack' || type === 'horizontal-stack') return { type, cards: [] };
    if (type === 'custom:terminal-light-card') return { type, entity: firstLight };
    const tag = type.startsWith('custom:') ? type.slice(7) : type;
    const constructor = customElements.get(tag);
    const stub = constructor?.getStubConfig?.(this._hass, [], []) || {};
    if (Object.keys(stub).length) return { type, ...stub };
    return { type, entity: firstEntity };
  }

  _appendCard(card) {
    const cards = [...this._config.cards, card];
    this._selected = cards.length - 1;
    this._guiMode = true;
    this._guiModeAvailable = true;
    this._emit({ ...this._config, cards }, true);
  }

  _move(delta) {
    const target = this._selected + delta;
    if (target < 0 || target >= this._config.cards.length) return;
    const cards = [...this._config.cards];
    const [card] = cards.splice(this._selected, 1);
    cards.splice(target, 0, card);
    this._selected = target;
    this._emit({ ...this._config, cards }, true);
  }

  _remove() {
    const cards = [...this._config.cards];
    cards.splice(this._selected, 1);
    this._selected = Math.max(0, Math.min(this._selected - 1, cards.length));
    this._emit({ ...this._config, cards }, true);
  }
}

defineElement(TAG, TerminalCardWrapperEditor);
