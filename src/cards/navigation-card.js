import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import {
  appearanceSchema,
  applyAccentColor,
  validateAppearance,
} from '../shared/appearance.js';
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
    transition: border-color 120ms ease;
  }
  .card:hover, .card:focus-within {
    border-color: var(--terminal-accent);
  }
  .card:hover .border-title, .card:focus-within .border-title {
    color: var(--terminal-accent);
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
  .border-title[data-title-position="right"] {
    right: 12px;
    left: auto;
  }
  .border-title[hidden] { display: none; }
  .main {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
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
  .card:hover .icon, .card:hover .name, .card:hover .arrow,
  .card:focus-within .icon, .card:focus-within .name,
  .card:focus-within .arrow { color: var(--terminal-accent); }
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
      entity: 'State entity',
      state_template: 'State template',
      accent_color: 'Accent color',
      title_position: 'Border title position',
      more_icon: 'Navigation icon',
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
          type: 'expandable',
          name: '',
          title: 'Secondary content',
          flatten: true,
          schema: [
            { name: 'entity', selector: { entity: {} } },
            { name: 'state_template', selector: { template: {} } },
            { name: 'label', selector: { text: {} } },
            { name: 'show_path', default: true, selector: { boolean: {} } },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Appearance',
          flatten: true,
          schema: appearanceSchema({ titlePosition: true, moreIcon: true }),
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) => {
        if (schema.name === 'state_template') {
          return 'Rendered reactively by Home Assistant. Template output overrides the entity state.';
        }
        if (schema.name === 'entity') {
          return 'Shows the formatted entity state when no template result is available.';
        }
        if (schema.name === 'label') {
          return 'Fallback shown before the navigation path.';
        }
        return undefined;
      },
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
    this._hass = null;
    this._templateValue = undefined;
    this._templateError = null;
    this._templateSubscription = null;
    this._templateConnection = null;
    this._templateText = null;
    this._templateGeneration = 0;

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

  connectedCallback() {
    this._ensureTemplateSubscription();
  }

  disconnectedCallback() {
    this._teardownTemplateSubscription();
    this._hass = null;
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
    if (
      config.entity !== undefined &&
      (typeof config.entity !== 'string' || !config.entity.trim())
    ) {
      throw new Error('terminal-navigation-card: "entity" must be a non-empty entity id');
    }
    if (
      config.state_template !== undefined &&
      typeof config.state_template !== 'string'
    ) {
      throw new Error('terminal-navigation-card: "state_template" must be a string');
    }
    validateAppearance(config, 'terminal-navigation-card', { titlePosition: true });
    this._teardownTemplateSubscription();
    this._config = { ...config };
    this._templateValue = undefined;
    this._templateError = null;
    this._render();
    this._ensureTemplateSubscription();
  }

  set hass(hass) {
    const connectionChanged = this._hass?.connection !== hass?.connection;
    this._hass = hass;
    this._render();
    if (connectionChanged || this._templateSubscription === null) {
      this._ensureTemplateSubscription();
    }
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: 'auto', min_columns: 3 };
  }

  _render() {
    if (!this._config) return;
    applyAccentColor(this, this._config.accent_color);
    const variant = this._config.variant || 'continuous';
    const pane = variant === 'pane';
    const name = this._config.name.trim();
    this.dataset.variant = variant;
    this._card.dataset.variant = variant;
    this._card.setAttribute('aria-label', `Navigate to ${name}`);
    this._borderTitle.hidden = !pane;
    this._borderTitle.dataset.titlePosition = this._config.title_position || 'left';
    this._borderTitle.textContent = name;
    this._name.hidden = pane;
    this._name.textContent = name;
    this._icon.icon = this._config.icon || 'mdi:arrow-right';
    this._arrow.icon = this._config.more_icon || 'mdi:chevron-right';
    const secondary = this._secondaryContent();
    this._secondary.hidden = secondary === '';
    this._secondary.textContent = secondary;
  }

  _secondaryContent() {
    if (this._templateValue !== undefined) return this._templateValue;
    if (this._config.entity) {
      const entity = this._hass?.states?.[this._config.entity];
      if (entity) {
        return String(this._hass?.formatEntityState?.(entity) || entity.state)
          .toLocaleLowerCase();
      }
      return 'unavailable';
    }
    if (this._config.label) return this._config.label;
    return this._config.show_path === false ? '' : this._config.navigation_path;
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
        if (message && typeof message.result === 'string') {
          this._templateValue = message.result;
          this._templateError = null;
          this._render();
        }
      }, params);
      this._templateSubscription = Promise.resolve(subscription);
      this._templateSubscription.catch(() => {
        if (generation !== this._templateGeneration) return;
        this._templateError = { error: 'template unavailable', level: 'ERROR' };
        this._templateSubscription = null;
        this._render();
      });
    } catch (_error) {
      if (generation !== this._templateGeneration) return;
      this._templateError = { error: 'template unavailable', level: 'ERROR' };
      this._templateSubscription = null;
      this._render();
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
