import { appearanceSchema } from '../shared/appearance.js';
import { defineElement, fireConfigChanged } from '../shared/ha.js';

const TAG = 'terminal-card-wrapper-editor';
const FORM_SCHEMA = [
  {
    type: 'grid',
    name: '',
    schema: [
      { name: 'title', required: true, selector: { text: {} } },
      { name: 'columns', selector: { number: { min: 1, mode: 'box' } } },
    ],
  },
  {
    type: 'expandable',
    name: '',
    title: 'Border state',
    flatten: true,
    schema: [
      { name: 'entity', selector: { entity: {} } },
      { name: 'state_template', selector: { template: {} } },
      {
        name: 'state_position',
        default: 'top-right',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'top-left', label: 'Top left' },
              { value: 'top-right', label: 'Top right' },
              { value: 'bottom-left', label: 'Bottom left' },
              { value: 'bottom-right', label: 'Bottom right' },
            ],
          },
        },
      },
    ],
  },
  {
    type: 'expandable',
    name: '',
    title: 'Appearance',
    flatten: true,
    schema: appearanceSchema({ titlePosition: true }),
  },
];

const STYLES = `
  :host { display: block; }
  .editor { display: grid; gap: 16px; }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  ha-tab-group {
    flex: 1 1 auto;
    min-width: 0;
    --ha-tab-track-color: var(--card-background-color);
  }
  .card-editor {
    padding: 12px;
    border: 1px solid var(--divider-color);
  }
  .card-options {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }
  .gui-mode-button {
    margin-right: auto;
    margin-inline-end: auto;
    margin-inline-start: initial;
  }
  .danger { color: var(--error-color); }
  ha-alert { display: block; }
  @media (max-width: 450px) {
    .card-editor { margin: 0 -12px; }
  }
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
    this._childEditor = null;
    this._picker = null;
    this._form = null;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._container = document.createElement('div');
    root.append(style, this._container);
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config && !this._container.hasChildNodes()) this._render();
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
    if (this._form) this._form.hass = this._hass;
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
    this._childEditor = null;
    this._picker = null;
    this._form = null;
    this._container.replaceChildren();

    const editor = document.createElement('div');
    editor.className = 'editor';
    this._form = document.createElement('ha-form');
    this._form.hass = this._hass;
    this._form.data = {
      title: this._config.title || '',
      ...(this._config.columns === undefined ? {} : { columns: this._config.columns }),
      ...(this._config.accent_color === undefined
        ? {}
        : { accent_color: this._config.accent_color }),
      ...(this._config.title_position === undefined
        ? {}
        : { title_position: this._config.title_position }),
      ...(this._config.entity === undefined ? {} : { entity: this._config.entity }),
      ...(this._config.state_template === undefined
        ? {}
        : { state_template: this._config.state_template }),
      ...(this._config.state_position === undefined
        ? {}
        : { state_position: this._config.state_position }),
    };
    this._form.schema = FORM_SCHEMA;
    this._form.computeLabel = (schema) => ({
      title: 'Border title',
      columns: 'Columns',
      accent_color: 'Accent color',
      title_position: 'Border title position',
      entity: 'State entity',
      state_template: 'State template',
      state_position: 'State position',
    })[schema.name] || schema.name;
    this._form.computeHelper = (schema) => {
      if (schema.name === 'columns') return 'Leave empty for a vertical list.';
      if (schema.name === 'entity') {
        return 'Fallback state shown when no template result is available.';
      }
      if (schema.name === 'state_template') {
        return 'Rendered reactively by Home Assistant and shown in the selected frame corner.';
      }
      return undefined;
    };
    this._form.addEventListener('value-changed', (event) => {
      event.stopPropagation();
      const value = event.detail?.value || {};
      const next = { ...this._config, title: value.title ?? '' };
      if (value.columns === undefined || value.columns === null || value.columns === '') {
        delete next.columns;
      } else {
        next.columns = Math.max(1, Number.parseInt(value.columns, 10) || 1);
      }
      for (const key of [
        'accent_color',
        'title_position',
        'entity',
        'state_template',
        'state_position',
      ]) {
        if (value[key] === undefined || value[key] === null || value[key] === '') {
          delete next[key];
        } else {
          next[key] = value[key];
        }
      }
      this._emit(next);
    });
    editor.append(this._form);

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    const tabs = document.createElement('ha-tab-group');
    tabs.setAttribute('aria-label', 'Child cards');
    this._config.cards.forEach((card, index) => {
      const tab = document.createElement('ha-tab-group-tab');
      tab.slot = 'nav';
      tab.panel = String(index);
      tab.active = index === this._selected;
      tab.textContent = String(index + 1);
      tab.title = card.type || 'manual';
      tab.addEventListener('click', () => this._select(index));
      tabs.append(tab);
    });
    tabs.addEventListener('wa-tab-show', (event) => {
      const index = Number.parseInt(event.detail?.name, 10);
      if (Number.isInteger(index)) this._select(index);
    });
    toolbar.append(tabs);
    toolbar.append(
      this._iconButton('mdi:plus', 'Add card', () => {
        this._selected = this._config.cards.length;
        this._render();
      }, 'add')
    );
    editor.append(toolbar);

    const cardEditor = document.createElement('div');
    cardEditor.className = 'card-editor';
    if (this._selected < this._config.cards.length) {
      this._renderCardOptions(cardEditor);
      this._renderChildEditor(cardEditor);
    } else {
      this._renderPicker(cardEditor);
    }
    editor.append(cardEditor);
    this._container.append(editor);
  }

  _iconButton(icon, label, handler, action, className = '') {
    const button = document.createElement('ha-icon-button');
    button.label = label;
    button.title = label;
    button.dataset.action = action;
    if (className) button.className = className;
    const iconElement = document.createElement('ha-icon');
    iconElement.icon = icon;
    button.append(iconElement);
    button.addEventListener('click', handler);
    return button;
  }

  _renderCardOptions(container) {
    const options = document.createElement('div');
    options.className = 'card-options';
    this._modeButton = this._iconButton(
      this._guiMode ? 'mdi:code-braces' : 'mdi:format-list-bulleted',
      this._guiMode ? 'Show code editor' : 'Show visual editor',
      () => {
        if (this._guiModeAvailable) this._childEditor?.toggleMode?.();
      },
      'mode',
      'gui-mode-button'
    );
    this._modeButton.disabled = !this._guiModeAvailable;
    options.append(this._modeButton);

    const previous = this._iconButton(
      'mdi:arrow-left',
      'Move before',
      () => this._move(-1),
      'prev'
    );
    previous.disabled = this._selected === 0;
    options.append(previous);

    const next = this._iconButton(
      'mdi:arrow-right',
      'Move after',
      () => this._move(1),
      'next'
    );
    next.disabled = this._selected === this._config.cards.length - 1;
    options.append(next);

    options.append(
      this._iconButton('mdi:delete', 'Remove card', () => this._remove(), 'delete', 'danger')
    );
    container.append(options);
  }

  _select(index) {
    if (index === this._selected) return;
    this._selected = index;
    this._guiMode = true;
    this._guiModeAvailable = true;
    this._render();
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
      this._updateModeButton();
    });
    container.append(this._childEditor);
  }

  _updateModeButton() {
    if (!this._modeButton) return;
    const icon = this._modeButton.querySelector('ha-icon');
    icon.icon = this._guiMode ? 'mdi:code-braces' : 'mdi:format-list-bulleted';
    const label = this._guiMode ? 'Show code editor' : 'Show visual editor';
    this._modeButton.label = label;
    this._modeButton.title = label;
    this._modeButton.disabled = !this._guiModeAvailable;
  }

  _renderPicker(container) {
    if (customElements.get('hui-card-picker')) {
      this._picker = document.createElement('hui-card-picker');
      this._picker.hass = this._hass;
      this._picker.lovelace = this._lovelace;
      this._picker.addEventListener('config-changed', (event) => {
        event.stopPropagation();
        const cards = [...this._config.cards, event.detail.config];
        this._selected = cards.length - 1;
        this._guiMode = true;
        this._guiModeAvailable = true;
        this._emit({ ...this._config, cards }, true);
      });
      container.append(this._picker);
      return;
    }

    const alert = document.createElement('ha-alert');
    alert.setAttribute('alert-type', 'warning');
    alert.textContent = 'Home Assistant’s native card picker is not available yet. Reopen the card editor.';
    container.append(alert);
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
