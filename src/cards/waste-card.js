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

const TAG = 'terminal-waste-card';
const DEFAULT_MAX_ENTRIES = 4;
const MAX_ENTRIES = 4;
const DEFAULT_DAYS_TO_SHOW = 90;
const MAX_DAYS_TO_SHOW = 365;
const REFRESH_INTERVAL = 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function calendarValue(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (typeof value.dateTime === 'string') return value.dateTime;
  if (typeof value.date === 'string') return value.date;
  return '';
}

function parseCalendarDate(value) {
  const raw = calendarValue(value);
  if (!raw) return null;
  if (DATE_ONLY_PATTERN.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isAllDayEvent(event) {
  const start = calendarValue(event?.start);
  return DATE_ONLY_PATTERN.test(start) || Boolean(event?.start?.date);
}

function dateKeyInTimeZone(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch (_error) {
    return date.toISOString().slice(0, 10);
  }
}

function dateKeyToUtcTime(key) {
  if (!DATE_ONLY_PATTERN.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function normalizedNumber(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= maximum
    ? number
    : null;
}

export class TerminalWasteCard extends HTMLElement {
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
    const candidates = [...entities, ...Object.keys(hass?.states || {})]
      .filter((entityId) => entityId.startsWith('calendar.'));
    const entity = candidates.find((entityId) => {
      const friendlyName = hass?.states?.[entityId]?.attributes?.friendly_name || '';
      return /waste|m[uü]ll|abfall/i.test(`${entityId} ${friendlyName}`);
    }) || candidates[0] || '';
    return {
      entity,
      title: 'waste status',
      max_entries: DEFAULT_MAX_ENTRIES,
      days_to_show: DEFAULT_DAYS_TO_SHOW,
    };
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._events = [];
    this._loading = true;
    this._error = null;
    this._subscription = null;
    this._subscriptionConnection = null;
    this._subscriptionEntity = null;
    this._subscriptionDays = null;
    this._generation = 0;
    this._refreshTimer = null;

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

  connectedCallback() {
    this._ensureSubscription();
  }

  disconnectedCallback() {
    this._clearRefreshTimer();
    this._teardownSubscription();
    this._hass = null;
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
    const maxEntries = normalizedNumber(
      config.max_entries,
      DEFAULT_MAX_ENTRIES,
      MAX_ENTRIES
    );
    if (maxEntries === null) {
      throw new Error(`${TAG}: "max_entries" must be an integer between 1 and ${MAX_ENTRIES}`);
    }
    const daysToShow = normalizedNumber(
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

    this._clearRefreshTimer();
    this._teardownSubscription();
    this._config = {
      ...config,
      max_entries: maxEntries,
      days_to_show: daysToShow,
    };
    this._events = [];
    this._loading = true;
    this._error = null;
    applyAccentColor(this, config.accent_color);
    this.style.removeProperty('--terminal-next-waste-color');
    this._render();
    this._ensureSubscription();
  }

  set hass(hass) {
    const connectionChanged = this._hass?.connection !== hass?.connection;
    this._hass = hass;
    this._render();
    if (connectionChanged || this._subscription === null) {
      this._ensureSubscription();
    }
  }

  getCardSize() {
    return Math.max(1, this._config?.max_entries || DEFAULT_MAX_ENTRIES);
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto' };
  }

  _visibleEvents() {
    const now = Date.now();
    const timeZone = this._hass?.config?.time_zone || 'UTC';
    const today = dateKeyInTimeZone(new Date(now), timeZone);
    return this._events
      .map((event, index) => {
        const allDay = isAllDayEvent(event);
        const start = parseCalendarDate(event?.start);
        const end = parseCalendarDate(event?.end);
        return {
          event,
          index,
          allDay,
          start,
          end,
          startDate: allDay
            ? calendarValue(event?.start)
            : start
              ? dateKeyInTimeZone(start, timeZone)
              : '',
          endDate: allDay ? calendarValue(event?.end) : '',
        };
      })
      .filter(({ allDay, start, end, startDate, endDate }) => {
        if (!start) return false;
        if (allDay) return endDate ? endDate > today : startDate >= today;
        return end ? end.getTime() > now : start.getTime() >= now;
      })
      .sort((left, right) => {
        const dateOrder = left.startDate.localeCompare(right.startDate);
        if (dateOrder) return dateOrder;
        return left.start.getTime() - right.start.getTime() || left.index - right.index;
      })
      .slice(0, this._config?.max_entries || DEFAULT_MAX_ENTRIES)
      .map(({ event }) => event);
  }

  _formatEventDate(event) {
    const start = parseCalendarDate(event?.start);
    if (!start) return 'date unavailable';
    const allDay = isAllDayEvent(event);
    const locale = this._hass?.locale?.language || navigator.language || 'en';
    const timeZone = this._hass?.config?.time_zone || 'UTC';
    const startDate = allDay
      ? calendarValue(event?.start)
      : dateKeyInTimeZone(start, timeZone);
    const today = dateKeyInTimeZone(new Date(Date.now()), timeZone);
    const startTime = dateKeyToUtcTime(startDate);
    const todayTime = dateKeyToUtcTime(today);
    const difference = startTime === null || todayTime === null
      ? null
      : Math.round((startTime - todayTime) / 86400000);
    try {
      const dateLabel = new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        ...(allDay ? { timeZone: 'UTC' } : { timeZone }),
      }).format(start);
      const relativeLabel = difference === null
        ? ''
        : new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(difference, 'day');
      return `${dateLabel}${relativeLabel ? ` · ${relativeLabel}` : ''}`
        .toLocaleLowerCase(locale);
    } catch (_error) {
      return startDate.toLocaleLowerCase();
    }
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

  _ensureSubscription() {
    const connection = this._hass?.connection;
    const entity = this._config?.entity;
    const days = this._config?.days_to_show;
    if (!this.isConnected || !connection?.subscribeMessage || !entity || !days) return;
    if (
      this._subscription !== null &&
      this._subscriptionConnection === connection &&
      this._subscriptionEntity === entity &&
      this._subscriptionDays === days
    ) {
      return;
    }

    this._clearRefreshTimer();
    this._teardownSubscription();
    const generation = ++this._generation;
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    this._subscriptionConnection = connection;
    this._subscriptionEntity = entity;
    this._subscriptionDays = days;
    this._loading = true;
    this._error = null;
    this._render();

    const params = {
      type: 'calendar/event/subscribe',
      entity_id: entity,
      start: start.toISOString(),
      end: end.toISOString(),
    };

    try {
      const subscription = connection.subscribeMessage((update) => {
        if (
          generation !== this._generation ||
          this._subscriptionConnection !== connection ||
          this._subscriptionEntity !== entity ||
          this._subscriptionDays !== days
        ) {
          return;
        }
        if (!update || !Array.isArray(update.events)) {
          this._events = [];
          this._loading = false;
          this._error = 'waste collections unavailable';
          this._render();
          return;
        }
        this._events = [...update.events];
        this._loading = false;
        this._error = null;
        this._render();
      }, params);
      this._subscription = Promise.resolve(subscription);
      this._subscription.catch(() => {
        if (generation !== this._generation) return;
        this._subscription = null;
        this._loading = false;
        this._error = 'waste collections unavailable';
        this._render();
      });
      this._scheduleRefresh();
    } catch (_error) {
      if (generation !== this._generation) return;
      this._subscription = null;
      this._loading = false;
      this._error = 'waste collections unavailable';
      this._render();
    }
  }

  _scheduleRefresh() {
    this._clearRefreshTimer();
    this._refreshTimer = window.setTimeout(() => {
      this._refreshTimer = null;
      if (!this.isConnected || !this._config) return;
      this._events = [];
      this._loading = true;
      this._teardownSubscription();
      this._render();
      this._ensureSubscription();
    }, REFRESH_INTERVAL);
  }

  _clearRefreshTimer() {
    if (this._refreshTimer !== null) window.clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
  }

  _teardownSubscription() {
    ++this._generation;
    const subscription = this._subscription;
    this._subscription = null;
    this._subscriptionConnection = null;
    this._subscriptionEntity = null;
    this._subscriptionDays = null;
    if (subscription) {
      Promise.resolve(subscription)
        .then((unsubscribe) => {
          if (typeof unsubscribe === 'function') unsubscribe();
        })
        .catch(() => undefined);
    }
  }
}

defineElement(TAG, TerminalWasteCard);
registerCard({
  type: TAG,
  name: 'Terminal Waste Card',
  description: 'Shows up to four upcoming waste collections with type-specific colors.',
  documentationURL: DOCUMENTATION_URL,
});
