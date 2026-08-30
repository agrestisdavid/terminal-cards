import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import {
  appearanceSchema,
  applyAccentColor,
  validateAppearance,
} from '../shared/appearance.js';
import {
  TERMINAL_BORDER_TITLE,
  TERMINAL_COLORS,
  TERMINAL_FONT,
} from '../shared/styles.js';
import {
  validateWasteColors,
  wasteColorForSummary,
  wasteColorSchema,
} from '../shared/waste.js';
import {
  WasteCalendarCardBase,
  findWasteCalendarEntity,
  normalizedWasteNumber,
} from '../shared/waste-calendar.js';

const TAG = 'terminal-waste-card';
const DEFAULT_MAX_ENTRIES = 4;
const MAX_ENTRIES = 4;
const DEFAULT_DAYS_TO_SHOW = 90;
const MAX_DAYS_TO_SHOW = 365;

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    box-sizing: border-box;
    display: block;
    height: 100%;
    padding-top: 8px;
  }
  .card {
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    min-height: 72px;
    height: 100%;
    padding: 16px 14px 14px;
    border: 1px solid var(--terminal-next-waste-color, var(--terminal-dim));
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
    font-size: 13px;
    line-height: 1.35;
    transition: border-color 120ms ease;
    --terminal-effective-accent: var(--terminal-next-waste-color, var(--terminal-accent));
  }
  .card:hover { border-color: var(--terminal-effective-accent); }
  .card .border-title {
    color: var(--terminal-next-waste-color, var(--terminal-dim));
    font-weight: 600;
  }
  .card[data-state="unavailable"],
  .card[data-state="error"] {
    border-color: var(--terminal-error);
    --terminal-effective-accent: var(--terminal-error);
  }
  .card[data-state="unavailable"] .border-title,
  .card[data-state="error"] .border-title,
  .card[data-state="unavailable"] .status,
  .card[data-state="error"] .status {
    color: var(--terminal-error);
  }
  ${TERMINAL_BORDER_TITLE}
  .entries {
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  .entry {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    min-width: 0;
    color: var(--terminal-entry-color, var(--terminal-accent));
  }
  .branch {
    color: currentColor;
    white-space: pre;
  }
  .entry-content { min-width: 0; }
  .date, .summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .date {
    color: var(--terminal-dim);
    font-size: 12px;
  }
  .summary {
    color: currentColor;
    font-weight: 600;
  }
  .status {
    padding: 10px 0;
    color: var(--terminal-dim);
    font-size: 12px;
  }
`;

export class TerminalWasteCard extends WasteCalendarCardBase {
  static getConfigForm() {
    const labels = {
      entity: 'Waste calendar entity',
      title: 'Border title',
      max_entries: 'Maximum entries',
      days_to_show: 'Days to search',
      title_position: 'Border title position',
      plastic_color: 'Plastic / yellow bag color',
      paper_color: 'Paper color',
      bio_color: 'Organic waste color',
      residual_color: 'Residual waste color',
      glass_color: 'Glass color',
      other_color: 'Other waste color',
    };
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { domain: 'calendar' } } },
        },
        { name: 'title', selector: { text: {} } },
        {
          type: 'grid',
          name: '',
          flatten: true,
          schema: [
            {
              name: 'max_entries',
              default: DEFAULT_MAX_ENTRIES,
              selector: {
                number: { min: 1, max: MAX_ENTRIES, step: 1, mode: 'box' },
              },
            },
            {
              name: 'days_to_show',
              default: DEFAULT_DAYS_TO_SHOW,
              selector: {
                number: { min: 1, max: MAX_DAYS_TO_SHOW, step: 1, mode: 'box' },
              },
            },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Waste colors',
          flatten: true,
          schema: wasteColorSchema(),
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
        if (schema.name === 'max_entries') {
          return `Show between 1 and ${MAX_ENTRIES} upcoming collections.`;
        }
        if (schema.name === 'days_to_show') {
          return `Search the next 1-${MAX_DAYS_TO_SHOW} days.`;
        }
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    return {
      entity: findWasteCalendarEntity(hass, entities),
      title: 'waste status',
      max_entries: DEFAULT_MAX_ENTRIES,
      days_to_show: DEFAULT_DAYS_TO_SHOW,
    };
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._card = document.createElement('article');
    this._card.className = 'card';
    this._borderTitle = document.createElement('div');
    this._borderTitle.className = 'border-title';
    this._entriesElement = document.createElement('div');
    this._entriesElement.className = 'entries';
    this._card.append(this._borderTitle, this._entriesElement);
    root.append(style, this._card);
  }

  setConfig(config) {
    if (!config?.entity || typeof config.entity !== 'string') {
      throw new Error(`${TAG}: "entity" is required`);
    }
    if (!config.entity.startsWith('calendar.')) {
      throw new Error(`${TAG}: "entity" must use calendar`);
    }
    if (
      config.title !== undefined &&
      (typeof config.title !== 'string' || !config.title.trim())
    ) {
      throw new Error(`${TAG}: "title" must be a non-empty string`);
    }
    const maxEntries = normalizedWasteNumber(
      config.max_entries,
      DEFAULT_MAX_ENTRIES,
      MAX_ENTRIES
    );
    if (maxEntries === null) {
      throw new Error(`${TAG}: "max_entries" must be an integer between 1 and ${MAX_ENTRIES}`);
    }
    const daysToShow = normalizedWasteNumber(
      config.days_to_show,
      DEFAULT_DAYS_TO_SHOW,
      MAX_DAYS_TO_SHOW
    );
    if (daysToShow === null) {
      throw new Error(
        `${TAG}: "days_to_show" must be an integer between 1 and ${MAX_DAYS_TO_SHOW}`
      );
    }
    validateAppearance(config, TAG, { titlePosition: true });
    validateWasteColors(config, TAG);

    applyAccentColor(this, config.accent_color);
    this.style.removeProperty('--terminal-next-waste-color');
    this._replaceCalendarConfig({
      ...config,
      max_entries: maxEntries,
      days_to_show: daysToShow,
    });
  }

  getCardSize() {
    return Math.max(1, this._config?.max_entries || DEFAULT_MAX_ENTRIES);
  }

  _render() {
    if (!this._config) return;
    const entity = this._hass?.states?.[this._config.entity];
    const unavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown';
    const title = this._config.title || entity?.attributes?.friendly_name || 'waste status';
    this._borderTitle.textContent = title;
    this._borderTitle.dataset.titlePosition = this._config.title_position || 'left';
    this._card.setAttribute('aria-label', title);
    this._entriesElement.replaceChildren();
    this.style.removeProperty('--terminal-next-waste-color');

    if (unavailable) {
      this._card.dataset.state = 'unavailable';
      this._appendStatus('waste calendar unavailable');
      return;
    }
    if (this._loading || this._error) {
      this._card.dataset.state = this._error ? 'error' : 'loading';
      this._appendStatus(this._error || 'loading collections…');
      return;
    }

    const events = this._visibleEvents();
    this._card.dataset.state = events.length ? 'ready' : 'empty';
    if (!events.length) {
      this._appendStatus('no upcoming collections');
      return;
    }

    events.forEach((event, index) => {
      const { type, color } = wasteColorForSummary(event?.summary, this._config);
      if (index === 0 && color) {
        this.style.setProperty('--terminal-next-waste-color', color);
      }
      const row = document.createElement('div');
      row.className = 'entry';
      row.dataset.wasteType = type;
      if (color) row.style.setProperty('--terminal-entry-color', color);
      const branch = document.createElement('div');
      branch.className = 'branch';
      branch.textContent = index === events.length - 1 ? '└─' : '├─';
      const content = document.createElement('div');
      content.className = 'entry-content';
      const date = document.createElement('div');
      date.className = 'date';
      date.textContent = this._formatEventDate(event);
      const summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = String(event?.summary || 'other waste')
        .toLocaleLowerCase(this._hass?.locale?.language || undefined);
      content.append(date, summary);
      row.append(branch, content);
      this._entriesElement.append(row);
    });
  }

  _appendStatus(message) {
    const status = document.createElement('div');
    status.className = 'status';
    status.textContent = message;
    this._entriesElement.append(status);
  }
}

defineElement(TAG, TerminalWasteCard);
registerCard({
  type: TAG,
  name: 'Terminal Waste Card',
  description: 'Shows up to four upcoming waste collections with type-specific colors.',
  documentationURL: DOCUMENTATION_URL,
});
