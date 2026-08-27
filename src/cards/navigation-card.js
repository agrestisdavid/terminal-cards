import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';

const TAG = 'terminal-navigation-card';
const VARIANTS = new Set(['continuous', 'pane']);

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    box-sizing: border-box;
    display: block;
    height: 100%;
  }
  :host([data-variant="pane"]) { padding-top: 8px; }
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
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .card:hover, .card:focus-within {
    border-color: var(--terminal-accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--terminal-accent) 45%, transparent);
  }
  .border-title {
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
  .border-title[hidden] { display: none; }
  .main {
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
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
  .icon, .arrow {
    flex: 0 0 auto;
    color: var(--terminal-dim);
    pointer-events: none;
  }
  .icon { width: 30px; height: 30px; }
  .arrow { width: 20px; height: 20px; }
  .card:hover .icon, .card:hover .arrow,
  .card:focus-within .icon, .card:focus-within .arrow { color: var(--terminal-accent); }
  .text { flex: 1 1 auto; min-width: 0; pointer-events: none; }
  .name, .secondary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name { font-weight: 600; }
  .name[hidden], .secondary[hidden] { display: none; }
  .secondary { color: var(--terminal-dim); font-size: 12px; }
`;

export class TerminalNavigationCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      navigation_path: 'Navigation path',
      name: 'Name',
      icon: 'Icon',
      variant: 'Border style',
      label: 'Secondary label',
      show_path: 'Show navigation path',
    };
    return {
      schema: [
        {
          name: 'navigation_path',
          required: true,
          selector: { navigation: {} },
        },
        {
          type: 'grid',
          name: '',
          flatten: true,
          schema: [
            { name: 'name', required: true, selector: { text: {} } },
            { name: 'icon', selector: { icon: {} } },
          ],
        },
        {
          name: 'variant',
          default: 'continuous',
          selector: {
            select: {
              mode: 'dropdown',
              options: [
                { value: 'continuous', label: 'Continuous border' },
                { value: 'pane', label: 'Name in border' },
              ],
            },
          },
        },
        {
          type: 'grid',
          name: '',
          flatten: true,
          schema: [
            { name: 'label', selector: { text: {} } },
            { name: 'show_path', default: true, selector: { boolean: {} } },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) =>
        schema.name === 'label'
          ? 'Overrides the displayed navigation path.'
          : undefined,
    };
  }

  static getStubConfig() {
    return {
      name: 'navigation',
      navigation_path: '/lovelace',
      icon: 'mdi:arrow-right',
      variant: 'continuous',
      show_path: true,
    };
  }

  constructor() {
    super();
    this._config = null;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._card = document.createElement('article');
    this._card.className = 'card';
    this._borderTitle = document.createElement('div');
    this._borderTitle.className = 'border-title';
    this._main = document.createElement('div');
    this._main.className = 'main';
    this._main.tabIndex = 0;
    this._main.setAttribute('role', 'link');
    this._icon = document.createElement('ha-icon');
    this._icon.className = 'icon';
    this._text = document.createElement('div');
    this._text.className = 'text';
    this._name = document.createElement('div');
    this._name.className = 'name';
    this._secondary = document.createElement('div');
    this._secondary.className = 'secondary';
    this._text.append(this._name, this._secondary);
    this._arrow = document.createElement('ha-icon');
    this._arrow.className = 'arrow';
    this._arrow.icon = 'mdi:chevron-right';
    this._main.append(this._icon, this._text, this._arrow);
    this._card.append(this._borderTitle, this._main);
    root.append(style, this._card);

    this._main.addEventListener('click', () => this._navigate());
    this._main.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this._navigate();
      }
    });
  }

  setConfig(config) {
    if (!config?.name || typeof config.name !== 'string' || !config.name.trim()) {
      throw new Error('terminal-navigation-card: "name" is required');
    }
    if (
      !config.navigation_path ||
      typeof config.navigation_path !== 'string' ||
      !config.navigation_path.trim()
    ) {
      throw new Error('terminal-navigation-card: "navigation_path" is required');
    }
    const navigationPath = config.navigation_path.trim();
    if (/^[a-z][a-z\d+.-]*:/i.test(navigationPath) || navigationPath.startsWith('//')) {
      throw new Error('terminal-navigation-card: "navigation_path" must be an internal path');
    }
    if (config.variant !== undefined && !VARIANTS.has(config.variant)) {
      throw new Error('terminal-navigation-card: "variant" must be continuous or pane');
    }
    this._config = { ...config };
    this._render();
  }

  set hass(_hass) {
    // Navigation cards do not depend on entity state.
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: 'auto', min_columns: 3 };
  }

  _render() {
    if (!this._config) return;
    const variant = this._config.variant || 'continuous';
    const pane = variant === 'pane';
    const name = this._config.name.trim();
    this.dataset.variant = variant;
    this._card.dataset.variant = variant;
    this._card.setAttribute('aria-label', `Navigate to ${name}`);
    this._borderTitle.hidden = !pane;
    this._borderTitle.textContent = name;
    this._name.hidden = pane;
    this._name.textContent = name;
    this._icon.icon = this._config.icon || 'mdi:arrow-right';
    const secondary = this._config.label ||
      (this._config.show_path === false ? '' : this._config.navigation_path);
    this._secondary.hidden = !secondary;
    this._secondary.textContent = secondary;
  }

  _navigate() {
    if (!this._config) return;
    try {
      const rawPath = this._config.navigation_path.trim();
      const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
      const destination = new URL(normalizedPath, window.location.href);
      if (destination.protocol !== window.location.protocol) return;
      const path = `${destination.pathname}${destination.search}${destination.hash}`;
      history.pushState(null, '', path);
      window.dispatchEvent(new CustomEvent('location-changed'));
    } catch (_error) {
      // Ignore malformed navigation paths from imported dashboard config.
    }
  }
}

defineElement(TAG, TerminalNavigationCard);
registerCard({
  type: TAG,
  name: 'Terminal Navigation Card',
  description: 'A terminal-style card for Home Assistant navigation paths.',
  documentationURL: DOCUMENTATION_URL,
});
