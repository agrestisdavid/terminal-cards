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

const TAG = 'terminal-calendar-card';
const DEFAULT_MAX_EVENTS = 3;
const MAX_EVENTS = 10;
const DEFAULT_DAYS_TO_SHOW = 30;
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
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font-family: ${TERMINAL_FONT};
    font-size: 13px;
    line-height: 1.35;
    transition: border-color 120ms ease;
  }
  .card:hover { border-color: var(--terminal-accent); }
  .card[data-state="unavailable"] { border-color: var(--terminal-error); }
  .card[data-state="unavailable"] .border-title,
  .card[data-state="unavailable"] .status { color: var(--terminal-error); }
  ${TERMINAL_BORDER_TITLE}
  .events {
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  .event {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    min-width: 0;
  }
  .branch {
    color: var(--terminal-dim);
    white-space: pre;
  }
  .event-content { min-width: 0; }
  .when, .summary, .location {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .when, .location, .status {
    color: var(--terminal-dim);
    font-size: 12px;
  }
  .summary { font-weight: 600; }
  .location { margin-top: 1px; }
  .status { padding: 10px 0; }
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

function normalizedNumber(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= maximum
    ? number
    : null;
}

export class TerminalCalendarCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      entity: 'Calendar entity',
      title: 'Border title',
      max_events: 'Maximum events',
      days_to_show: 'Days to search',
      show_location: 'Show event location',
      accent_color: 'Accent color',
      title_position: 'Border title position',
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
              name: 'max_events',
              default: DEFAULT_MAX_EVENTS,
              selector: {
                number: { min: 1, max: MAX_EVENTS, step: 1, mode: 'box' },
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
        { name: 'show_location', default: false, selector: { boolean: {} } },
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
        if (schema.name === 'max_events') {
          return `Show between 1 and ${MAX_EVENTS} upcoming events.`;
        }
        if (schema.name === 'days_to_show') {
          return `Search the next 1-${MAX_DAYS_TO_SHOW} days.`;
        }
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    const candidates = [...entities, ...Object.keys(hass?.states || {})];
    const entity = candidates.find((entityId) => entityId.startsWith('calendar.')) || '';
    return {
      entity,
      max_events: DEFAULT_MAX_EVENTS,
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
    this._eventsElement = document.createElement('div');
    this._eventsElement.className = 'events';
    this._card.append(this._borderTitle, this._eventsElement);
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
    const maxEvents = normalizedNumber(config.max_events, DEFAULT_MAX_EVENTS, MAX_EVENTS);
    if (maxEvents === null) {
      throw new Error(`${TAG}: "max_events" must be an integer between 1 and ${MAX_EVENTS}`);
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
    if (config.show_location !== undefined && typeof config.show_location !== 'boolean') {
      throw new Error(`${TAG}: "show_location" must be a boolean`);
    }
    validateAppearance(config, TAG, { titlePosition: true });

    this._clearRefreshTimer();
    this._teardownSubscription();
    this._config = {
      ...config,
      max_events: maxEvents,
      days_to_show: daysToShow,
      show_location: config.show_location === true,
    };
    this._events = [];
    this._loading = true;
    this._error = null;
    applyAccentColor(this, config.accent_color);
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
    return Math.max(1, this._config?.max_events || DEFAULT_MAX_EVENTS);
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
        if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
        return left.start.getTime() - right.start.getTime() || left.index - right.index;
      })
      .slice(0, this._config?.max_events || DEFAULT_MAX_EVENTS)
      .map(({ event }) => event);
  }

  _formatEventTime(event) {
    const start = parseCalendarDate(event?.start);
    if (!start) return 'time unavailable';
    const allDay = isAllDayEvent(event);
    const locale = this._hass?.locale?.language || navigator.language || 'en';
    const timeZone = this._hass?.config?.time_zone;
    const dateOptions = {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      ...(allDay ? { timeZone: 'UTC' } : timeZone ? { timeZone } : {}),
    };
    try {
      const dateFormatter = new Intl.DateTimeFormat(locale, dateOptions);
      const startDate = dateFormatter.format(start);
      if (allDay) return `${startDate} · all-day`.toLocaleLowerCase(locale);

      const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        ...(timeZone ? { timeZone } : {}),
      };
      const timeFormatter = new Intl.DateTimeFormat(locale, timeOptions);
      const startLabel = `${startDate}, ${timeFormatter.format(start)}`;
      const end = parseCalendarDate(event?.end);
      if (!end) return startLabel.toLocaleLowerCase(locale);

      const sameDay = dateKeyInTimeZone(start, timeZone || 'UTC') ===
        dateKeyInTimeZone(end, timeZone || 'UTC');
      const endLabel = sameDay
        ? timeFormatter.format(end)
        : `${dateFormatter.format(end)}, ${timeFormatter.format(end)}`;
      return `${startLabel}–${endLabel}`.toLocaleLowerCase(locale);
    } catch (_error) {
      return calendarValue(event?.start).toLocaleLowerCase();
    }
  }

  _render() {
    if (!this._config) return;
    const entity = this._hass?.states?.[this._config.entity];
    const unavailable = !entity || entity.state === 'unavailable';
    const title = this._config.title || entity?.attributes?.friendly_name || 'calendar';
    this._borderTitle.textContent = title;
    this._borderTitle.dataset.titlePosition = this._config.title_position || 'left';
    this._card.dataset.state = unavailable ? 'unavailable' : 'ready';
    this._card.setAttribute('aria-label', title);
    this._eventsElement.replaceChildren();

    if (this._loading || this._error) {
      const status = document.createElement('div');
      status.className = 'status';
      status.textContent = this._error || 'loading events…';
      this._eventsElement.append(status);
      return;
    }

    const events = this._visibleEvents();
    if (!events.length) {
      const status = document.createElement('div');
      status.className = 'status';
      status.textContent = 'no upcoming events';
      this._eventsElement.append(status);
      return;
    }

    events.forEach((event, index) => {
      const row = document.createElement('div');
      row.className = 'event';
      const branch = document.createElement('div');
      branch.className = 'branch';
      branch.textContent = index === events.length - 1 ? '└─' : '├─';
      const content = document.createElement('div');
      content.className = 'event-content';
      const when = document.createElement('div');
      when.className = 'when';
      when.textContent = this._formatEventTime(event);
      const summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = String(event?.summary || 'untitled event');
      content.append(summary, when);
      if (this._config.show_location && event?.location) {
        const location = document.createElement('div');
        location.className = 'location';
        location.textContent = String(event.location);
        content.append(location);
      }
      row.append(branch, content);
      this._eventsElement.append(row);
    });
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

    // Mirrors HA 2026.8's native subscribeCalendarEvents contract.
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
          this._error = 'calendar events unavailable';
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
        this._error = 'calendar events unavailable';
        this._render();
      });
      this._scheduleRefresh();
    } catch (_error) {
      if (generation !== this._generation) return;
      this._subscription = null;
      this._loading = false;
      this._error = 'calendar events unavailable';
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

defineElement(TAG, TerminalCalendarCard);
registerCard({
  type: TAG,
  name: 'Terminal Calendar Card',
  description: 'Shows the next events from one Home Assistant calendar.',
  documentationURL: DOCUMENTATION_URL,
});
