import {
  appearanceSchema,
  applyAccentColor,
  validateAppearance,
} from '../shared/appearance.js';
import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import {
  TERMINAL_BORDER_TITLE,
  TERMINAL_COLORS,
  TERMINAL_ENTITY_ALIGNMENT,
  TERMINAL_FONT,
  TERMINAL_MAIN_ICON_HOVER,
} from '../shared/styles.js';
import {
  WASTE_TYPES,
  validateWasteColors,
  validateWasteIcons,
  wasteColorForSummary,
  wasteColorSchema,
  wasteIconForSummary,
  wasteIconSchema,
} from '../shared/waste.js';
import {
  WasteCalendarCardBase,
  findWasteCalendarEntity,
  normalizedWasteNumber,
} from '../shared/waste-calendar.js';

const TAG = 'terminal-waste-status-card';
const DEFAULT_MAX_ENTRIES = 4;
const MAX_ENTRIES = 4;
const DEFAULT_DAYS_TO_SHOW = 90;
const MAX_DAYS_TO_SHOW = 365;
const DEFAULT_MORE_ICON = 'mdi:dots-horizontal';
const DEFAULT_TILES_TITLE = 'next collections';

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    box-sizing: border-box;
    container-type: inline-size;
    display: block;
    height: 100%;
    padding-top: 8px;
  }
  .card {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 72px;
    height: 100%;
    border: 1px solid var(--terminal-next-waste-color, var(--terminal-dim));
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
    font-size: 13px;
    line-height: 1.35;
    overflow: visible;
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
  .card[data-state="unavailable"] .main-icon,
  .card[data-state="error"] .main-icon,
  .card[data-state="unavailable"] .main-status,
  .card[data-state="error"] .main-status {
    color: var(--terminal-error);
  }
  .main {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 14px;
    min-width: 0;
    min-height: 72px;
    padding: 12px 14px;
  }
  .main-icon {
    flex: 0 0 auto;
    color: var(--terminal-effective-accent);
    --mdc-icon-size: 28px;
  }
  .main-text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .main-name, .main-status {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .main-name { font-weight: 600; }
  .main-status {
    color: var(--terminal-dim);
    font-size: 12px;
  }
  .expand {
    box-sizing: border-box;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    line-height: 0;
    cursor: pointer;
  }
  .expand[hidden] { display: none; }
  .expand:hover,
  .expand:focus-visible,
  .expand[aria-expanded="true"] {
    border-color: currentColor;
    color: var(--terminal-effective-accent);
    outline: none;
  }
  .expand:disabled { cursor: default; opacity: .55; }
  .expand ha-icon {
    width: 20px;
    height: 20px;
    --mdc-icon-size: 20px;
  }
  .tiles-frame {
    position: relative;
    box-sizing: border-box;
    margin: 4px 14px 12px;
    padding: 18px 10px 10px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
  }
  .tiles-frame[hidden] { display: none; }
  .tiles-title {
    position: absolute;
    z-index: 1;
    top: 0;
    left: 10px;
    box-sizing: border-box;
    transform: translateY(-50%);
    max-width: calc(100% - 20px);
    padding: 0 7px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--terminal-background);
    color: var(--terminal-effective-accent);
    font: 11px/1.4 ${TERMINAL_FONT};
    font-weight: 600;
    pointer-events: none;
  }
  .tiles {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .tile {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) minmax(70px, auto);
    align-items: center;
    gap: 10px;
    min-width: 0;
    min-height: 54px;
    padding: 7px 10px;
    border: 1px solid var(--terminal-entry-color, var(--terminal-accent));
    border-radius: 0;
    color: var(--terminal-entry-color, var(--terminal-accent));
  }
  .tile-icon {
    box-sizing: border-box;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid transparent;
    color: currentColor;
    line-height: 0;
    --mdc-icon-size: 24px;
  }
  .tile:hover .tile-icon { border-color: currentColor; }
  .tile-text { min-width: 0; }
  .tile-name, .tile-date, .tile-days {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tile-name { color: currentColor; font-weight: 600; }
  .tile-date { color: var(--terminal-dim); font-size: 11px; }
  .tile-days {
    min-width: 0;
    color: currentColor;
    font-size: 11px;
    text-align: right;
  }
  @container (max-width: 260px) {
    .main {
      gap: 10px;
      padding-inline: 10px;
    }
    .tiles-frame { margin-inline: 10px; }
    .tile {
      grid-template-columns: 34px minmax(0, 1fr) minmax(58px, auto);
      gap: 8px;
      padding-inline: 8px;
    }
    .tile-days { font-size: 10px; }
  }
  ${TERMINAL_BORDER_TITLE}
  ${TERMINAL_ENTITY_ALIGNMENT}
  ${TERMINAL_MAIN_ICON_HOVER}
`;

export class TerminalWasteStatusCard extends WasteCalendarCardBase {
  static getConfigForm() {
    const labels = {
      entity: 'Waste calendar entity',
      title: 'Border title',
      tiles_title: 'Expanded list title',
      max_entries: 'Maximum entries',
      days_to_show: 'Days to search',
      controls_expanded: 'Expand list by default',
      always_expanded: 'Always expanded',
      accent_color: 'Fallback accent color',
      more_icon: 'Expand button icon',
      title_position: 'Border title position',
    };
    for (const {
      colorKey,
      label,
      iconKey,
      iconLabel,
    } of WASTE_TYPES) {
      labels[colorKey] = label;
      labels[iconKey] = iconLabel;
    }
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { domain: 'calendar' } } },
        },
        {
          type: 'grid',
          name: '',
          flatten: true,
          schema: [
            { name: 'title', selector: { text: {} } },
            { name: 'tiles_title', selector: { text: {} } },
          ],
        },
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
          title: 'Display and expansion',
          flatten: true,
          schema: [
            { name: 'controls_expanded', default: false, selector: { boolean: {} } },
            { name: 'always_expanded', default: false, selector: { boolean: {} } },
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
          title: 'Waste icons',
          flatten: true,
          schema: wasteIconSchema(),
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
        if (schema.name === 'always_expanded') {
          return 'Keeps the list visible and hides the expand button.';
        }
        if (schema.name === 'controls_expanded') {
          return 'Sets the initial list state when Always expanded is off.';
        }
        if (schema.name === 'max_entries') {
          return `Show between 1 and ${MAX_ENTRIES} upcoming collections.`;
        }
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    return {
      entity: findWasteCalendarEntity(hass, entities),
      title: 'waste status',
      tiles_title: DEFAULT_TILES_TITLE,
      max_entries: DEFAULT_MAX_ENTRIES,
      days_to_show: DEFAULT_DAYS_TO_SHOW,
      controls_expanded: false,
      always_expanded: false,
    };
  }

  constructor() {
    super();
    this._tilesExpanded = false;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._card = document.createElement('article');
    this._card.className = 'card';
    this._borderTitle = document.createElement('div');
    this._borderTitle.className = 'border-title';
    this._main = document.createElement('div');
    this._main.className = 'main';
    this._mainIcon = document.createElement('ha-icon');
    this._mainIcon.className = 'icon main-icon';
    this._mainText = document.createElement('div');
    this._mainText.className = 'text main-text';
    this._mainName = document.createElement('div');
    this._mainName.className = 'main-name';
    this._mainStatus = document.createElement('div');
    this._mainStatus.className = 'main-status';
    this._mainStatus.setAttribute('aria-live', 'polite');
    this._mainText.append(this._mainName, this._mainStatus);
    this._expand = document.createElement('button');
    this._expand.className = 'expand';
    this._expand.type = 'button';
    this._expand.title = 'Toggle waste collections';
    this._expand.setAttribute('aria-label', 'Toggle waste collections');
    this._expand.setAttribute('aria-controls', 'terminal-waste-status-tiles');
    this._expandIcon = document.createElement('ha-icon');
    this._expandIcon.icon = DEFAULT_MORE_ICON;
    this._expand.append(this._expandIcon);
    this._main.append(this._mainIcon, this._mainText, this._expand);
    this._tilesFrame = document.createElement('div');
    this._tilesFrame.id = 'terminal-waste-status-tiles';
    this._tilesFrame.className = 'tiles-frame';
    this._tilesFrame.setAttribute('role', 'region');
    this._tilesFrame.setAttribute('aria-labelledby', 'terminal-waste-status-tiles-title');
    this._tilesTitle = document.createElement('div');
    this._tilesTitle.id = 'terminal-waste-status-tiles-title';
    this._tilesTitle.className = 'tiles-title';
    this._tiles = document.createElement('div');
    this._tiles.className = 'tiles';
    this._tiles.setAttribute('role', 'list');
    this._tilesFrame.append(this._tilesTitle, this._tiles);
    this._card.append(this._borderTitle, this._main, this._tilesFrame);
    root.replaceChildren(style, this._card);

    this._expand.addEventListener('click', () => {
      if (this._config?.always_expanded === true || this._expand.disabled) return;
      this._tilesExpanded = !this._tilesExpanded;
      this._render();
    });
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
    for (const key of ['controls_expanded', 'always_expanded']) {
      if (config?.[key] !== undefined && typeof config[key] !== 'boolean') {
        throw new Error(`${TAG}: "${key}" must be a boolean`);
      }
    }
    if (
      config?.tiles_title !== undefined &&
      (typeof config.tiles_title !== 'string' || !config.tiles_title.trim())
    ) {
      throw new Error(`${TAG}: "tiles_title" must be a non-empty string`);
    }
    const maxEntries = normalizedWasteNumber(
      config?.max_entries,
      DEFAULT_MAX_ENTRIES,
      MAX_ENTRIES
    );
    if (maxEntries === null) {
      throw new Error(`${TAG}: "max_entries" must be an integer between 1 and ${MAX_ENTRIES}`);
    }
    const daysToShow = normalizedWasteNumber(
      config?.days_to_show,
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
    validateWasteIcons(config, TAG);

    const previousEntity = this._config?.entity;
    const previousDefault = this._config?.controls_expanded;
    const previousAlways = this._config?.always_expanded;
    const resetExpansion = (
      previousEntity !== config?.entity ||
      previousDefault !== config?.controls_expanded ||
      previousAlways !== config?.always_expanded
    );
    applyAccentColor(this, config.accent_color);
    this.style.removeProperty('--terminal-next-waste-color');
    this._replaceCalendarConfig({
      ...config,
      max_entries: maxEntries,
      days_to_show: daysToShow,
    });
    if (config.always_expanded === true) {
      this._tilesExpanded = true;
    } else if (resetExpansion) {
      this._tilesExpanded = config.controls_expanded === true;
    }
    this._render();
  }

  getCardSize() {
    if (!this._tilesExpanded && this._config?.always_expanded !== true) return 1;
    const visibleCount = this._visibleEvents().length;
    return visibleCount ? 1 + visibleCount : 1;
  }

  _formatStatusParts(event) {
    const full = this._formatEventDate(event);
    const [date, ...relative] = full.split(' · ');
    return { date, relative: relative.join(' · ') };
  }

  _render() {
    if (!this._config) return;
    const entity = this._hass?.states?.[this._config.entity];
    const unavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown';
    const title = this._config.title || entity?.attributes?.friendly_name || 'waste status';
    const alwaysExpanded = this._config.always_expanded === true;
    const events = unavailable || this._loading || this._error ? [] : this._visibleEvents();
    const nextEvent = events[0];

    this._borderTitle.textContent = title;
    this._borderTitle.dataset.titlePosition = this._config.title_position || 'left';
    this._tilesTitle.textContent = this._config.tiles_title || DEFAULT_TILES_TITLE;
    this._expandIcon.icon = this._config.more_icon || DEFAULT_MORE_ICON;
    this._expand.hidden = alwaysExpanded;
    this._expand.disabled = unavailable || this._loading || Boolean(this._error) || !events.length;
    this._expand.setAttribute('aria-expanded', String(alwaysExpanded || this._tilesExpanded));
    this._tilesFrame.hidden = !events.length || !(alwaysExpanded || this._tilesExpanded);
    this._tiles.replaceChildren();
    this.style.removeProperty('--terminal-next-waste-color');

    if (unavailable) {
      this._card.dataset.state = 'unavailable';
      this._mainIcon.icon = this._config.other_icon || 'mdi:delete-outline';
      this._mainName.textContent = title;
      this._mainStatus.textContent = 'waste calendar unavailable';
    } else if (this._loading || this._error) {
      this._card.dataset.state = this._error ? 'error' : 'loading';
      this._mainIcon.icon = this._config.other_icon || 'mdi:delete-outline';
      this._mainName.textContent = title;
      this._mainStatus.textContent = this._error || 'loading collections…';
    } else if (!nextEvent) {
      this._card.dataset.state = 'empty';
      this._mainIcon.icon = this._config.other_icon || 'mdi:delete-outline';
      this._mainName.textContent = 'no upcoming collections';
      this._mainStatus.textContent = '';
    } else {
      const { color } = wasteColorForSummary(nextEvent.summary, this._config);
      if (color) this.style.setProperty('--terminal-next-waste-color', color);
      this._card.dataset.state = 'ready';
      this._mainIcon.icon = wasteIconForSummary(nextEvent.summary, this._config);
      this._mainName.textContent = String(nextEvent.summary || 'other waste')
        .toLocaleLowerCase(this._hass?.locale?.language || undefined);
      this._mainStatus.textContent = this._formatEventDate(nextEvent);
    }

    this._card.setAttribute(
      'aria-label',
      `${this._mainName.textContent}: ${this._mainStatus.textContent}`.replace(/:\s*$/, '')
    );

    if (!events.length || !(alwaysExpanded || this._tilesExpanded)) return;
    for (const event of events) {
      const { type, color } = wasteColorForSummary(event.summary, this._config);
      const { date, relative } = this._formatStatusParts(event);
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'listitem');
      tile.dataset.wasteType = type;
      if (color) tile.style.setProperty('--terminal-entry-color', color);
      const icon = document.createElement('ha-icon');
      icon.className = 'tile-icon';
      icon.icon = wasteIconForSummary(event.summary, this._config);
      const text = document.createElement('div');
      text.className = 'tile-text';
      const name = document.createElement('div');
      name.className = 'tile-name';
      name.textContent = String(event.summary || 'other waste')
        .toLocaleLowerCase(this._hass?.locale?.language || undefined);
      const dateElement = document.createElement('div');
      dateElement.className = 'tile-date';
      dateElement.textContent = date;
      text.append(name, dateElement);
      const days = document.createElement('div');
      days.className = 'tile-days';
      days.textContent = relative;
      tile.append(icon, text, days);
      this._tiles.append(tile);
    }
  }
}

defineElement(TAG, TerminalWasteStatusCard);
registerCard({
  type: TAG,
  name: 'Terminal Waste Status Card',
  description: 'Shows the next waste collection with expandable colored status tiles.',
  documentationURL: DOCUMENTATION_URL,
});
