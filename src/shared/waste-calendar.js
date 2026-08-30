const REFRESH_INTERVAL = 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function findWasteCalendarEntity(hass, entities = []) {
  const candidates = [...entities, ...Object.keys(hass?.states || {})]
    .filter((entityId) => entityId.startsWith('calendar.'));
  return candidates.find((entityId) => {
    const friendlyName = hass?.states?.[entityId]?.attributes?.friendly_name || '';
    return /waste|m[uü]ll|abfall/i.test(`${entityId} ${friendlyName}`);
  }) || candidates[0] || '';
}

export function normalizedWasteNumber(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= maximum
    ? number
    : null;
}

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

export function visibleWasteEvents(events, hass, maxEntries) {
  const now = Date.now();
  const timeZone = hass?.config?.time_zone || 'UTC';
  const today = dateKeyInTimeZone(new Date(now), timeZone);
  return (events || [])
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
    .slice(0, maxEntries)
    .map(({ event }) => event);
}

export function formatWasteEventDate(event, hass) {
  const start = parseCalendarDate(event?.start);
  if (!start) return 'date unavailable';
  const allDay = isAllDayEvent(event);
  const locale = hass?.locale?.language || navigator.language || 'en';
  const timeZone = hass?.config?.time_zone || 'UTC';
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

export class WasteCalendarCardBase extends HTMLElement {
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
  }

  connectedCallback() {
    this._ensureSubscription();
  }

  disconnectedCallback() {
    this._clearRefreshTimer();
    this._teardownSubscription();
    this._hass = null;
  }

  set hass(hass) {
    const connectionChanged = this._hass?.connection !== hass?.connection;
    this._hass = hass;
    this._render();
    if (connectionChanged || this._subscription === null) {
      this._ensureSubscription();
    }
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto' };
  }

  _replaceCalendarConfig(config) {
    this._clearRefreshTimer();
    this._teardownSubscription();
    this._config = config;
    this._events = [];
    this._loading = true;
    this._error = null;
    this._render();
    this._ensureSubscription();
  }

  _visibleEvents() {
    return visibleWasteEvents(
      this._events,
      this._hass,
      this._config?.max_entries || 4
    );
  }

  _formatEventDate(event) {
    return formatWasteEventDate(event, this._hass);
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
