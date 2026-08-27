import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import {
  appearanceSchema,
  applyAccentColor,
  validateAppearance,
} from '../shared/appearance.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';
import {
  DEFAULT_TITLE_FONT_SIZE,
  MAX_TITLE_FONT_SIZE,
  MIN_TITLE_FONT_SIZE,
  normalizeTitleFontSize,
} from '../shared/title.js';

const TAG = 'terminal-title-card';
const TEMPLATE_PATTERN = /{{|{%|{#/;

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    --terminal-title-font-size: ${DEFAULT_TITLE_FONT_SIZE}px;
    box-sizing: border-box;
    display: block;
    min-height: max(48px, calc(var(--terminal-title-font-size) * 1.2 + 18px));
    height: 100%;
    padding-top: calc(var(--terminal-title-font-size) * .48);
  }
  .frame {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: max(36px, calc(var(--terminal-title-font-size) * .8 + 18px));
    height: 100%;
    border: 1px solid var(--terminal-accent);
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
  }
  .frame[data-has-subtitle="true"] {
    display: flex;
    align-items: center;
    min-height: max(56px, calc(var(--terminal-title-font-size) * 1.1 + 36px));
  }
  .frame[data-has-subtitle="true"][data-title-position="left"] {
    /* The title's 1.1 line box sits 58% below the border after translateY(-42%). */
    padding-top: calc(var(--terminal-title-font-size) * .638 + 1px);
  }
  .title {
    position: absolute;
    z-index: 1;
    top: 0;
    left: 12px;
    box-sizing: border-box;
    transform: translateY(-42%);
    max-width: calc(100% - 24px);
    padding: 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--terminal-background);
    color: var(--terminal-accent);
    font: 700 var(--terminal-title-font-size)/1.1 ${TERMINAL_FONT};
    pointer-events: none;
  }
  .title[data-title-position="right"] {
    right: 12px;
    left: auto;
  }
  .subtitle {
    box-sizing: border-box;
    display: block;
    width: 100%;
    min-width: 0;
    padding: 0 14px;
    overflow-wrap: anywhere;
    color: var(--terminal-dim);
    font: 12px/1.35 ${TERMINAL_FONT};
    --mdc-typography-body1-font-family: ${TERMINAL_FONT};
    --mdc-typography-body1-font-size: 12px;
    --mdc-typography-body1-line-height: 1.35;
  }
  .frame[data-has-subtitle="true"][data-title-position="left"] .subtitle {
    padding-left: 20px;
  }
  .subtitle[hidden] { display: none; }
`;

export class TerminalTitleCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      title: 'Title',
      subtitle: 'Subtitle (Markdown / template)',
      font_size: 'Title size',
      accent_color: 'Accent color',
      title_position: 'Title position',
    };
    return {
      schema: [
        { name: 'title', required: true, selector: { text: {} } },
        { name: 'subtitle', selector: { template: {} } },
        {
          name: 'font_size',
          default: DEFAULT_TITLE_FONT_SIZE,
          selector: {
            number: {
              min: MIN_TITLE_FONT_SIZE,
              max: MAX_TITLE_FONT_SIZE,
              step: 1,
              mode: 'box',
              unit_of_measurement: 'px',
            },
          },
        },
        {
          type: 'expandable',
          name: '',
          title: 'Appearance',
          flatten: true,
          schema: appearanceSchema({ titlePosition: true }),
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) => {
        if (schema.name === 'font_size') {
          return `Choose ${MIN_TITLE_FONT_SIZE}-${MAX_TITLE_FONT_SIZE} px.`;
        }
        if (schema.name === 'subtitle') {
          return 'Supports Markdown and reactive Home Assistant templates.';
        }
        return undefined;
      },
    };
  }

  static getStubConfig() {
    return {
      title: 'terminal title',
      font_size: DEFAULT_TITLE_FONT_SIZE,
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
    this._frame = document.createElement('section');
    this._frame.className = 'frame';
    this._title = document.createElement('div');
    this._title.className = 'title';
    this._subtitle = document.createElement('ha-markdown');
    this._subtitle.className = 'subtitle';
    this._subtitle.hidden = true;
    this._frame.append(this._title, this._subtitle);
    root.append(style, this._frame);
  }

  connectedCallback() {
    this._ensureTemplateSubscription();
  }

  disconnectedCallback() {
    this._teardownTemplateSubscription();
    this._hass = null;
    this._subtitle.hass = null;
  }

  setConfig(config) {
    if (!config || typeof config.title !== 'string' || !config.title.trim()) {
      throw new Error('terminal-title-card: "title" is required');
    }
    if (config.subtitle !== undefined && typeof config.subtitle !== 'string') {
      throw new Error('terminal-title-card: "subtitle" must be a string');
    }
    const fontSize = normalizeTitleFontSize(config.font_size);
    if (fontSize === null) {
      throw new Error(
        `terminal-title-card: "font_size" must be between ${MIN_TITLE_FONT_SIZE} and ${MAX_TITLE_FONT_SIZE}`
      );
    }
    validateAppearance(config, 'terminal-title-card', { titlePosition: true });
    this._teardownTemplateSubscription();
    this._config = { ...config, font_size: fontSize };
    this._templateValue = undefined;
    this._templateError = null;
    this.style.setProperty('--terminal-title-font-size', `${fontSize}px`);
    applyAccentColor(this, config.accent_color);
    this._title.textContent = config.title;
    this._title.dataset.titlePosition = config.title_position || 'left';
    this._frame.dataset.titlePosition = config.title_position || 'left';
    this._frame.setAttribute('aria-label', config.title);
    this._renderSubtitle();
    this._ensureTemplateSubscription();
  }

  set hass(hass) {
    const connectionChanged = this._hass?.connection !== hass?.connection;
    this._hass = hass;
    this._subtitle.hass = hass;
    this._renderSubtitle();
    if (connectionChanged || this._templateSubscription === null) {
      this._ensureTemplateSubscription();
    }
  }

  getCardSize() {
    const titleSize = Math.max(
      1,
      Math.ceil((this._config?.font_size || DEFAULT_TITLE_FONT_SIZE) / DEFAULT_TITLE_FONT_SIZE)
    );
    return this._config?.subtitle?.trim() ? Math.max(2, titleSize) : titleSize;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto' };
  }

  _renderSubtitle() {
    if (!this._config) return;
    const subtitle = this._config.subtitle || '';
    const usesTemplate = TEMPLATE_PATTERN.test(subtitle);
    const content = usesTemplate
      ? this._templateValue ?? (this._templateError ? 'template unavailable' : '')
      : subtitle;
    const hasSubtitle = Boolean(subtitle.trim());
    this._frame.dataset.hasSubtitle = String(hasSubtitle);
    this._subtitle.hidden = !hasSubtitle;
    this._subtitle.hass = this._hass;
    this._subtitle.content = content;
  }

  _ensureTemplateSubscription() {
    const template = typeof this._config?.subtitle === 'string'
      ? this._config.subtitle
      : '';
    const connection = this._hass?.connection;
    if (
      !this.isConnected ||
      !template.trim() ||
      !TEMPLATE_PATTERN.test(template) ||
      !connection?.subscribeMessage
    ) {
      return;
    }
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
          this._templateValue = undefined;
          this._renderSubtitle();
          return;
        }
        if (message && message.result !== undefined) {
          this._templateValue = String(message.result);
          this._templateError = null;
          this._renderSubtitle();
        }
      }, params);
      this._templateSubscription = Promise.resolve(subscription);
      this._templateSubscription.catch(() => {
        if (generation !== this._templateGeneration) return;
        this._templateError = { error: 'template unavailable', level: 'ERROR' };
        this._templateSubscription = null;
        this._renderSubtitle();
      });
    } catch (_error) {
      if (generation !== this._templateGeneration) return;
      this._templateError = { error: 'template unavailable', level: 'ERROR' };
      this._templateSubscription = null;
      this._renderSubtitle();
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
}

defineElement(TAG, TerminalTitleCard);
registerCard({
  type: TAG,
  name: 'Terminal Title Card',
  description: 'A compact terminal frame with a border title and reactive subtitle.',
  documentationURL: DOCUMENTATION_URL,
});
