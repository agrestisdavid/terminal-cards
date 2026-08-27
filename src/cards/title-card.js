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

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    --terminal-title-font-size: ${DEFAULT_TITLE_FONT_SIZE}px;
    box-sizing: border-box;
    display: block;
    min-height: max(72px, calc(var(--terminal-title-font-size) * 1.8 + 24px));
    height: 100%;
    padding-top: calc(var(--terminal-title-font-size) * .6);
  }
  .frame {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: calc(var(--terminal-title-font-size) * 1.2 + 24px);
    height: 100%;
    border: 1px solid var(--terminal-accent);
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
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
    color: var(--terminal-accent);
    font: 700 var(--terminal-title-font-size)/1.2 ${TERMINAL_FONT};
    pointer-events: none;
  }
  .title[data-title-position="right"] {
    right: 12px;
    left: auto;
  }
`;

export class TerminalTitleCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      title: 'Title',
      font_size: 'Title size',
      accent_color: 'Accent color',
      title_position: 'Title position',
    };
    return {
      schema: [
        { name: 'title', required: true, selector: { text: {} } },
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
      computeHelper: (schema) => schema.name === 'font_size'
        ? `Choose ${MIN_TITLE_FONT_SIZE}-${MAX_TITLE_FONT_SIZE} px.`
        : undefined,
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

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._frame = document.createElement('section');
    this._frame.className = 'frame';
    this._title = document.createElement('div');
    this._title.className = 'title';
    this._frame.append(this._title);
    root.append(style, this._frame);
  }

  setConfig(config) {
    if (!config || typeof config.title !== 'string' || !config.title.trim()) {
      throw new Error('terminal-title-card: "title" is required');
    }
    const fontSize = normalizeTitleFontSize(config.font_size);
    if (fontSize === null) {
      throw new Error(
        `terminal-title-card: "font_size" must be between ${MIN_TITLE_FONT_SIZE} and ${MAX_TITLE_FONT_SIZE}`
      );
    }
    validateAppearance(config, 'terminal-title-card', { titlePosition: true });
    this._config = { ...config, font_size: fontSize };
    this.style.setProperty('--terminal-title-font-size', `${fontSize}px`);
    applyAccentColor(this, config.accent_color);
    this._title.textContent = config.title;
    this._title.dataset.titlePosition = config.title_position || 'left';
    this._frame.setAttribute('aria-label', config.title);
  }

  set hass(_hass) {
    // Decorative card: no entity state is required.
  }

  getCardSize() {
    return Math.max(
      1,
      Math.ceil((this._config?.font_size || DEFAULT_TITLE_FONT_SIZE) / DEFAULT_TITLE_FONT_SIZE)
    );
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto' };
  }
}

defineElement(TAG, TerminalTitleCard);
registerCard({
  type: TAG,
  name: 'Terminal Title Card',
  description: 'A terminal frame with a large configurable border title.',
  documentationURL: DOCUMENTATION_URL,
});
