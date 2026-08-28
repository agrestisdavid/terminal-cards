import {
  DOCUMENTATION_URL,
  defineElement,
  executeAction,
  registerCard,
} from '../shared/ha.js';
import {
  appearanceSchema,
  applyAccentColor,
  validateAppearance,
} from '../shared/appearance.js';
import {
  closeTerminalEntityPopup,
  updateTerminalEntityPopup,
} from '../shared/popup.js';
import { TERMINAL_COLORS, TERMINAL_FONT } from '../shared/styles.js';
import {
  DEFAULT_TITLE_FONT_SIZE,
  MAX_TITLE_FONT_SIZE,
  MIN_TITLE_FONT_SIZE,
  normalizeTitleFontSize,
} from '../shared/title.js';

const TAG = 'terminal-title-card';
const TEMPLATE_PATTERN = /{{|{%|{#/;
const STATE_POSITIONS = new Set([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);

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
  :host([data-state-edge="bottom"]) { padding-bottom: 8px; }
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
    min-height: max(40px, calc(var(--terminal-title-font-size) * .638 + 24px));
    padding-top: calc(var(--terminal-title-font-size) * .638 + 1px);
  }
  .border-slot {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: calc(100% - 24px);
    pointer-events: none;
  }
  .border-slot[data-position="top-left"] {
    top: 0;
    left: 12px;
    transform: translateY(-42%);
  }
  .border-slot[data-position="top-right"] {
    top: 0;
    right: 12px;
    justify-content: flex-end;
    transform: translateY(-42%);
  }
  .border-slot[data-position="bottom-left"] {
    bottom: 0;
    left: 12px;
    transform: translateY(50%);
  }
  .border-slot[data-position="bottom-right"] {
    right: 12px;
    bottom: 0;
    justify-content: flex-end;
    transform: translateY(50%);
  }
  .frame[data-top-split="true"] .border-slot[data-edge="top"] {
    max-width: calc(50% - 15px);
  }
  .title {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    padding: 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--terminal-background);
    color: var(--terminal-accent);
    font: 700 var(--terminal-title-font-size)/1.1 ${TERMINAL_FONT};
    pointer-events: none;
  }
  .border-state {
    appearance: none;
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    overflow: visible;
    white-space: nowrap;
    background: transparent;
    color: var(--terminal-dim);
    font: 12px/1.4 ${TERMINAL_FONT};
    opacity: 1;
    pointer-events: none;
  }
  .border-state[data-interactive="true"] {
    margin: -8px 0;
    padding: 8px 0;
    cursor: pointer;
    pointer-events: auto;
  }
  .border-state-text {
    display: block;
    min-width: 0;
    box-sizing: border-box;
    max-width: 100%;
    padding: 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--terminal-background);
  }
  .border-state[data-interactive="true"]:hover,
  .border-state[data-interactive="true"]:focus-visible {
    color: var(--terminal-accent);
    outline: 1px solid var(--terminal-accent);
    outline-offset: 1px;
  }
  .border-slot > .title:first-child:nth-last-child(2),
  .border-slot > .title:first-child:nth-last-child(2) ~ .border-state {
    max-width: calc(50% - 3px);
  }
  .border-state[hidden] { display: none; }
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
  .frame[data-has-subtitle="true"][data-state-edge="bottom"] {
    padding-bottom: 9px;
  }
  .subtitle[hidden] { display: none; }
`;

export class TerminalTitleCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      title: 'Title',
      subtitle: 'Subtitle (Markdown / template)',
      entity: 'State entity',
      state_template: 'State template',
      state_position: 'State position',
      state_tap_action: 'State tap action',
      popup_title: 'Popup border title',
      font_size: 'Title size',
      accent_color: 'Accent color',
      title_position: 'Title position',
    };
    return {
      schema: [
        { name: 'title', required: true, selector: { text: {} } },
        { name: 'subtitle', selector: { template: {} } },
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
            { name: 'popup_title', selector: { text: {} } },
            {
              name: 'state_tap_action',
              selector: {
                ui_action: {
                  actions: ['more-info', 'navigate', 'url', 'perform-action', 'none'],
                  default_action: 'more-info',
                },
              },
            },
          ],
        },
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
        if (schema.name === 'entity') {
          return 'Fallback state shown when no template result is available.';
        }
        if (schema.name === 'state_template') {
          return 'Rendered reactively by Home Assistant and embedded in the selected frame corner.';
        }
        if (schema.name === 'state_tap_action') {
          return 'Runs when the entity-backed border state is activated. More-info opens the terminal popup.';
        }
        if (schema.name === 'popup_title') {
          return 'Overrides the default “more-info” title embedded in the popup border.';
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
    this._stateTemplateValue = undefined;
    this._stateTemplateError = null;
    this._stateTemplateSubscription = null;
    this._stateTemplateConnection = null;
    this._stateTemplateText = null;
    this._stateTemplateGeneration = 0;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._frame = document.createElement('section');
    this._frame.className = 'frame';
    this._slots = Object.fromEntries(
      [...STATE_POSITIONS].map((position) => {
        const slot = document.createElement('div');
        slot.className = 'border-slot';
        slot.dataset.position = position;
        slot.dataset.edge = position.startsWith('top') ? 'top' : 'bottom';
        return [position, slot];
      })
    );
    this._title = document.createElement('div');
    this._title.className = 'title';
    this._state = document.createElement('button');
    this._state.className = 'border-state';
    this._state.type = 'button';
    this._state.hidden = true;
    this._state.disabled = true;
    this._stateText = document.createElement('span');
    this._stateText.className = 'border-state-text';
    this._state.append(this._stateText);
    this._state.addEventListener('click', () => this._activateState());
    this._subtitle = document.createElement('ha-markdown');
    this._subtitle.className = 'subtitle';
    this._subtitle.hidden = true;
    this._frame.append(...Object.values(this._slots), this._subtitle);
    root.append(style, this._frame);
  }

  connectedCallback() {
    this._ensureTemplateSubscription();
    this._ensureStateTemplateSubscription();
  }

  disconnectedCallback() {
    this._teardownTemplateSubscription();
    this._teardownStateTemplateSubscription();
    closeTerminalEntityPopup(this._state);
    this._hass = null;
    this._subtitle.hass = null;
  }

  setConfig(config) {
    closeTerminalEntityPopup(this._state);
    if (!config || typeof config.title !== 'string' || !config.title.trim()) {
      throw new Error('terminal-title-card: "title" is required');
    }
    if (config.subtitle !== undefined && typeof config.subtitle !== 'string') {
      throw new Error('terminal-title-card: "subtitle" must be a string');
    }
    if (
      config.entity !== undefined &&
      (typeof config.entity !== 'string' || !config.entity.trim())
    ) {
      throw new Error('terminal-title-card: "entity" must be a non-empty entity id');
    }
    if (
      config.state_template !== undefined &&
      typeof config.state_template !== 'string'
    ) {
      throw new Error('terminal-title-card: "state_template" must be a string');
    }
    if (
      config.state_position !== undefined &&
      !STATE_POSITIONS.has(config.state_position)
    ) {
      throw new Error(
        'terminal-title-card: "state_position" must be top-left, top-right, bottom-left or bottom-right'
      );
    }
    const fontSize = normalizeTitleFontSize(config.font_size);
    if (fontSize === null) {
      throw new Error(
        `terminal-title-card: "font_size" must be between ${MIN_TITLE_FONT_SIZE} and ${MAX_TITLE_FONT_SIZE}`
      );
    }
    if (
      config.state_tap_action !== undefined &&
      (!config.state_tap_action || typeof config.state_tap_action !== 'object' ||
        Array.isArray(config.state_tap_action))
    ) {
      throw new Error('terminal-title-card: "state_tap_action" must be an action object');
    }
    validateAppearance(config, 'terminal-title-card', {
      titlePosition: true,
      popupTitle: true,
    });
    this._teardownTemplateSubscription();
    this._teardownStateTemplateSubscription();
    this._config = { ...config, font_size: fontSize };
    this._templateValue = undefined;
    this._templateError = null;
    this._stateTemplateValue = undefined;
    this._stateTemplateError = null;
    this.style.setProperty('--terminal-title-font-size', `${fontSize}px`);
    applyAccentColor(this, config.accent_color);
    this._title.textContent = config.title;
    this._title.dataset.titlePosition = config.title_position || 'left';
    this._frame.dataset.titlePosition = config.title_position || 'left';
    this._renderBorderLabels();
    this._renderSubtitle();
    this._ensureTemplateSubscription();
    this._ensureStateTemplateSubscription();
  }

  set hass(hass) {
    const connectionChanged = this._hass?.connection !== hass?.connection;
    this._hass = hass;
    this._subtitle.hass = hass;
    updateTerminalEntityPopup(hass);
    this._renderBorderLabels();
    this._renderSubtitle();
    if (connectionChanged || this._templateSubscription === null) {
      this._ensureTemplateSubscription();
    }
    if (connectionChanged || this._stateTemplateSubscription === null) {
      this._ensureStateTemplateSubscription();
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

  _stateContent() {
    if (this._stateTemplateValue !== undefined) return this._stateTemplateValue;
    if (this._config?.entity) {
      const entity = this._hass?.states?.[this._config.entity];
      if (!entity) return 'unavailable';
      return String(this._hass?.formatEntityState?.(entity) || entity.state)
        .toLocaleLowerCase();
    }
    return '';
  }

  _renderBorderLabels() {
    if (!this._config) return;
    const titlePosition = this._config.title_position === 'right'
      ? 'top-right'
      : 'top-left';
    const statePosition = this._config.state_position ||
      (titlePosition === 'top-left' ? 'top-right' : 'top-left');
    const stateContent = this._stateContent();
    const showState = Boolean(
      (this._config.entity || this._config.state_template?.trim()) &&
      stateContent !== ''
    );
    const stateAction = this._config.state_tap_action || { action: 'more-info' };
    const action = stateAction.action || 'none';

    this._slots[titlePosition].append(this._title);
    this._stateText.textContent = stateContent;
    this._state.dataset.statePosition = statePosition;
    const interactive = showState && Boolean(this._config.entity) && action !== 'none';
    this._state.dataset.interactive = String(interactive);
    this._state.disabled = !interactive;
    this._state.hidden = !showState;
    if (interactive) {
      const entity = this._hass?.states?.[this._config.entity];
      const name = entity?.attributes?.friendly_name || this._config.entity;
      const verb = action === 'more-info'
        ? 'open controls for'
        : action === 'navigate'
          ? 'navigate from'
          : action === 'url'
            ? 'open link for'
            : 'run action for';
      this._state.setAttribute(
        'aria-label',
        `${verb} ${name}, current state ${stateContent}`
      );
      if (action === 'more-info') this._state.setAttribute('aria-haspopup', 'dialog');
      else this._state.removeAttribute('aria-haspopup');
    } else {
      this._state.removeAttribute('aria-label');
      this._state.removeAttribute('aria-haspopup');
    }
    if (showState) this._slots[statePosition].append(this._state);
    else this._state.remove();
    this._frame.dataset.topSplit = String(
      showState && titlePosition.startsWith('top') && statePosition.startsWith('top') &&
      titlePosition !== statePosition
    );
    if (showState && statePosition.startsWith('bottom')) {
      this.dataset.stateEdge = 'bottom';
      this._frame.dataset.stateEdge = 'bottom';
    } else {
      delete this.dataset.stateEdge;
      delete this._frame.dataset.stateEdge;
    }
    const ariaState = showState ? `, ${stateContent}` : '';
    this._frame.setAttribute('aria-label', `${this._config.title}${ariaState}`);
  }

  _activateState() {
    if (!this._config?.entity || !this._hass) return;
    executeAction(
      this._state,
      this._hass,
      this._config,
      this._config.state_tap_action || { action: 'more-info' }
    );
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

  _ensureStateTemplateSubscription() {
    const template = typeof this._config?.state_template === 'string'
      ? this._config.state_template
      : '';
    const connection = this._hass?.connection;
    if (
      !this.isConnected ||
      !template.trim() ||
      !connection?.subscribeMessage
    ) {
      return;
    }
    if (
      this._stateTemplateSubscription !== null &&
      this._stateTemplateConnection === connection &&
      this._stateTemplateText === template
    ) {
      return;
    }

    this._teardownStateTemplateSubscription();
    const generation = ++this._stateTemplateGeneration;
    this._stateTemplateConnection = connection;
    this._stateTemplateText = template;
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
          generation !== this._stateTemplateGeneration ||
          this._stateTemplateConnection !== connection ||
          this._stateTemplateText !== template
        ) {
          return;
        }
        if (message && typeof message.error === 'string') {
          this._stateTemplateError = message;
          this._stateTemplateValue = undefined;
          this._renderBorderLabels();
          return;
        }
        if (message && message.result !== undefined) {
          this._stateTemplateValue = String(message.result).toLocaleLowerCase();
          this._stateTemplateError = null;
          this._renderBorderLabels();
        }
      }, params);
      this._stateTemplateSubscription = Promise.resolve(subscription);
      this._stateTemplateSubscription.catch(() => {
        if (generation !== this._stateTemplateGeneration) return;
        this._stateTemplateError = { error: 'template unavailable', level: 'ERROR' };
        this._stateTemplateSubscription = null;
        this._renderBorderLabels();
      });
    } catch (_error) {
      if (generation !== this._stateTemplateGeneration) return;
      this._stateTemplateError = { error: 'template unavailable', level: 'ERROR' };
      this._stateTemplateSubscription = null;
      this._renderBorderLabels();
    }
  }

  _teardownStateTemplateSubscription() {
    ++this._stateTemplateGeneration;
    const subscription = this._stateTemplateSubscription;
    this._stateTemplateSubscription = null;
    this._stateTemplateConnection = null;
    this._stateTemplateText = null;
    if (subscription) {
      Promise.resolve(subscription)
        .then((unsubscribe) => {
          if (typeof unsubscribe === 'function') unsubscribe();
        })
        .catch(() => undefined);
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
