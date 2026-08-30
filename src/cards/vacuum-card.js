import { DOCUMENTATION_URL, defineElement, registerCard } from '../shared/ha.js';
import {
  appearanceSchema,
  applyAccentColor,
  validateAppearance,
} from '../shared/appearance.js';
import {
  TERMINAL_BORDER_TITLE,
  TERMINAL_COLORS,
  TERMINAL_ENTITY_ALIGNMENT,
  TERMINAL_FONT,
  TERMINAL_MAIN_ICON_HOVER,
} from '../shared/styles.js';
import {
  VACUUM_SUPPORT_CLEAN_AREA,
  VACUUM_SUPPORT_FAN_SPEED,
  VACUUM_SUPPORT_PAUSE,
  VACUUM_SUPPORT_RETURN_HOME,
  VACUUM_SUPPORT_START,
  cleaningModeUsesMop,
  createMapProjection,
  isVacuumUnavailable,
  mapImageRevision,
  projectRoomRectangle,
  revisionedMapImageSource,
  safeMapImageSource,
  vacuumOptionLabel,
  vacuumOptionValues,
  vacuumRoomModel,
  vacuumStateLabel,
  vacuumSupports,
} from '../shared/vacuum.js';

const TAG = 'terminal-vacuum-card';
const DEFAULT_NORMAL_MODE = 'standard';
const DEFAULT_THOROUGH_MODE = 'deep';

const STYLES = `
  :host {
    ${TERMINAL_COLORS}
    box-sizing: border-box;
    container-type: inline-size;
    display: block;
    height: 100%;
  }
  :host([data-border-title="true"]) { padding-top: 8px; }
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
    overflow: visible;
    transition: border-color 120ms ease;
  }
  .card[data-state="cleaning"],
  .card[data-state="paused"],
  .card[data-state="returning"] { border-color: var(--terminal-accent); }
  .card[data-state="unavailable"],
  .card[data-state="error"] { border-color: var(--terminal-error); }
  .card:not([data-state="unavailable"]):not([data-state="error"]):hover,
  .card:not([data-state="unavailable"]):not([data-state="error"]):focus-within {
    border-color: var(--terminal-accent);
  }
  .main {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 72px;
    padding: 12px 14px;
  }
  @container (max-width: 420px) {
    .main { gap: 10px; padding-inline: 10px; }
  }
  .icon {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    color: var(--terminal-dim);
    pointer-events: none;
  }
  .card[data-state="cleaning"] .icon,
  .card[data-state="paused"] .icon,
  .card[data-state="returning"] .icon { color: var(--terminal-accent); }
  .card[data-state="unavailable"] .icon,
  .card[data-state="error"] .icon { color: var(--terminal-error); }
  .text { flex: 1 1 auto; min-width: 0; pointer-events: none; }
  .name, .state { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name { font-weight: 600; }
  .state { color: var(--terminal-dim); font-size: 12px; }
  .card[data-state="unavailable"] .state,
  .card[data-state="error"] .state { color: var(--terminal-error); }
  .map-frame {
    box-sizing: border-box;
    margin: 0 14px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: var(--terminal-background);
    overflow: hidden;
  }
  @container (max-width: 420px) { .map-frame { margin-inline: 10px; } }
  .map-surface { position: relative; width: 100%; min-height: 120px; }
  .map-image { display: block; width: 100%; height: auto; border: 0; }
  .map-image[hidden] { display: none; }
  .map-message {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    min-height: 120px;
    padding: 16px;
    color: var(--terminal-dim);
    text-align: center;
  }
  .map-message[hidden] { display: none; }
  .room-layer { position: absolute; inset: 0; overflow: hidden; }
  .room-layer[hidden] { display: none; }
  .room-zone {
    position: absolute;
    box-sizing: border-box;
    min-width: 34px;
    min-height: 34px;
    transform: translate(-50%, -50%);
    padding: 0;
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--terminal-text);
    cursor: pointer;
  }
  .room-zone:not(:disabled):hover,
  .room-zone:not(:disabled):focus-visible {
    border-color: var(--terminal-accent);
    outline: none;
  }
  .room-zone[aria-pressed="true"] {
    border-color: var(--terminal-accent);
    background: color-mix(in srgb, var(--terminal-accent) 20%, transparent);
  }
  .room-zone:disabled { cursor: not-allowed; }
  .room-label {
    position: absolute;
    top: 50%;
    left: 50%;
    max-width: calc(100% - 6px);
    transform: translate(-50%, -50%);
    padding: 1px 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 1px solid var(--terminal-dim);
    background: color-mix(in srgb, var(--terminal-background) 82%, transparent);
    color: var(--terminal-text);
    font: 10px/1.4 ${TERMINAL_FONT};
    pointer-events: none;
  }
  .room-zone[aria-pressed="true"] .room-label {
    border-color: var(--terminal-accent);
    color: var(--terminal-accent);
    font-weight: 700;
  }
  .room-zone:disabled .room-label { color: var(--terminal-dim); opacity: .75; }
  .selection-row {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 34px;
    margin: 0 14px;
    color: var(--terminal-dim);
    font-size: 11px;
  }
  @container (max-width: 420px) { .selection-row { margin-inline: 10px; } }
  .selection-summary { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .clear-selection {
    flex: 0 0 auto;
    min-height: 26px;
    padding: 0 8px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    font: 11px/1 ${TERMINAL_FONT};
    cursor: pointer;
  }
  .clear-selection[hidden] { display: none; }
  .clear-selection:hover, .clear-selection:focus-visible {
    border-color: var(--terminal-accent);
    color: var(--terminal-accent);
    outline: none;
  }
  .settings {
    box-sizing: border-box;
    display: grid;
    gap: 10px;
    padding: 8px 14px 12px;
    border-top: 1px solid var(--terminal-dim);
  }
  @container (max-width: 420px) { .settings { padding-inline: 10px; } }
  .setting-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  @container (max-width: 420px) { .setting-grid { grid-template-columns: 1fr; } }
  .setting {
    display: grid;
    grid-template-columns: minmax(74px, auto) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .setting[hidden] { display: none; }
  .setting label, .mode-label { color: var(--terminal-dim); font-size: 11px; }
  .setting select {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 32px;
    padding: 0 24px 0 8px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: var(--terminal-background);
    color: var(--terminal-text);
    font: 12px/1 ${TERMINAL_FONT};
  }
  .setting select:hover, .setting select:focus-visible {
    border-color: var(--terminal-accent);
    outline: none;
  }
  .setting select:disabled { cursor: not-allowed; opacity: .5; }
  .mode-setting { grid-template-columns: minmax(74px, auto) minmax(0, 1fr); }
  .mode-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .mode-button, .command {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--terminal-dim);
    border-radius: 0;
    background: transparent;
    color: var(--terminal-dim);
    font: 11px/1 ${TERMINAL_FONT};
    cursor: pointer;
  }
  .mode-button:hover, .mode-button:focus-visible,
  .command:hover, .command:focus-visible {
    border-color: var(--terminal-accent);
    color: var(--terminal-accent);
    outline: none;
  }
  .mode-button[data-active="true"] {
    border-color: var(--terminal-accent);
    background: color-mix(in srgb, var(--terminal-accent) 14%, transparent);
    color: var(--terminal-accent);
    font-weight: 700;
  }
  .mode-button:disabled, .command:disabled { cursor: not-allowed; opacity: .45; }
  .commands { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .command { height: 36px; font-size: 12px; }
  .command ha-icon { width: 18px; height: 18px; --mdc-icon-size: 18px; }
  .command[data-primary="true"] { border-color: var(--terminal-accent); color: var(--terminal-accent); }
  .operation-status {
    min-height: 16px;
    color: var(--terminal-dim);
    font-size: 11px;
  }
  .operation-status[data-error="true"] { color: var(--terminal-error); }
  ${TERMINAL_BORDER_TITLE}
  ${TERMINAL_ENTITY_ALIGNMENT}
  ${TERMINAL_MAIN_ICON_HOVER}
`;

function entityField(name, domain, required = false) {
  return {
    name,
    required,
    selector: { entity: { filter: { domain } } },
  };
}

function validateEntity(config, key, domain, required = false) {
  const value = config?.[key];
  if (required && (!value || typeof value !== 'string')) {
    throw new Error(`${TAG}: "${key}" is required`);
  }
  if (value !== undefined && value !== '' && (
    typeof value !== 'string' || !value.startsWith(`${domain}.`)
  )) {
    throw new Error(`${TAG}: "${key}" must be a ${domain}`);
  }
}

function validateBoolean(config, key) {
  if (config?.[key] !== undefined && typeof config[key] !== 'boolean') {
    throw new Error(`${TAG}: "${key}" must be a boolean`);
  }
}

function stateMatches(entity, values) {
  return entity && values.includes(entity.state);
}

function associationScore(hass, vacuumEntityId, candidateEntityId) {
  const vacuumRegistry = hass?.entities?.[vacuumEntityId];
  const candidateRegistry = hass?.entities?.[candidateEntityId];
  if (
    vacuumRegistry?.device_id &&
    candidateRegistry?.device_id &&
    vacuumRegistry.device_id === candidateRegistry.device_id
  ) return 100;
  const vacuumName = String(vacuumEntityId || '').split('.', 2)[1] || '';
  const candidateName = String(candidateEntityId || '').split('.', 2)[1] || '';
  if (vacuumName && (
    candidateName === vacuumName || candidateName.startsWith(`${vacuumName}_`)
  )) return 80;
  return 0;
}

function associatedEntity(hass, vacuumEntityId, candidateIds, allowUniqueFallback) {
  const candidates = [...new Set(candidateIds.filter(Boolean))];
  const scored = candidates.map((entityId) => ({
    entityId,
    score: associationScore(hass, vacuumEntityId, entityId),
  }));
  const bestScore = Math.max(0, ...scored.map((candidate) => candidate.score));
  const best = scored.filter((candidate) => candidate.score === bestScore && bestScore > 0);
  if (best.length === 1) return best[0].entityId;
  return allowUniqueFallback && candidates.length === 1 ? candidates[0] : '';
}

export class TerminalVacuumCard extends HTMLElement {
  static getConfigForm() {
    const labels = {
      entity: 'Vacuum entity',
      map_entity: 'Map image entity',
      cleaning_mode_entity: 'Cleaning mode entity',
      mop_intensity_entity: 'Mop intensity entity',
      mop_mode_entity: 'Normal / thorough entity',
      battery_entity: 'Battery entity',
      name: 'Name',
      icon: 'Icon',
      show_state: 'Show state',
      show_battery: 'Show battery',
      show_room_labels: 'Show room labels on map',
      normal_mode: 'Normal mode value',
      thorough_mode: 'Thorough mode value',
      accent_color: 'Accent color',
      border_title: 'Border title',
      title_position: 'Border title position',
    };
    return {
      schema: [
        entityField('entity', 'vacuum', true),
        entityField('map_entity', 'image', true),
        {
          type: 'grid',
          name: '',
          flatten: true,
          schema: [
            { name: 'name', selector: { text: {} } },
            {
              name: 'icon',
              selector: { icon: {} },
              context: { icon_entity: 'entity' },
            },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Vacuum controls',
          flatten: true,
          schema: [
            entityField('cleaning_mode_entity', 'select'),
            entityField('mop_intensity_entity', 'select'),
            entityField('mop_mode_entity', 'select'),
            entityField('battery_entity', 'sensor'),
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Display',
          flatten: true,
          schema: [
            { name: 'show_state', default: true, selector: { boolean: {} } },
            { name: 'show_battery', default: true, selector: { boolean: {} } },
            { name: 'show_room_labels', default: true, selector: { boolean: {} } },
          ],
        },
        {
          type: 'expandable',
          name: '',
          title: 'Appearance',
          flatten: true,
          schema: appearanceSchema({ borderTitle: true, titlePosition: true }),
        },
        {
          type: 'expandable',
          name: '',
          title: 'Advanced mode mapping',
          flatten: true,
          schema: [
            { name: 'normal_mode', selector: { text: {} } },
            { name: 'thorough_mode', selector: { text: {} } },
          ],
        },
      ],
      computeLabel: (schema) => labels[schema.name] || schema.name,
      computeHelper: (schema) => {
        if (schema.name === 'map_entity') {
          return 'Requires rooms and calibration_points attributes for clickable areas.';
        }
        if (schema.name === 'normal_mode') return 'Defaults to “standard”.';
        if (schema.name === 'thorough_mode') {
          return 'Defaults to Roborock “deep”; this changes the mop path, not the pass count.';
        }
        if (schema.name === 'border_title') {
          return 'Optional label embedded in the upper border.';
        }
        return undefined;
      },
    };
  }

  static getStubConfig(hass, entities = []) {
    const candidates = [...new Set([...entities, ...Object.keys(hass?.states || {})])];
    const vacuumEntities = candidates.filter((entityId) => entityId.startsWith('vacuum.'));
    const calibratedMaps = candidates.filter((entityId) => {
      const state = hass?.states?.[entityId];
      return entityId.startsWith('image.') && state?.attributes?.rooms &&
        Array.isArray(state.attributes.calibration_points);
    });
    const entity = vacuumEntities.find((entityId) =>
      associatedEntity(hass, entityId, calibratedMaps, false)
    ) || vacuumEntities[0] || '';
    const allowUniqueFallback = vacuumEntities.length <= 1;
    const mapEntity = associatedEntity(
      hass,
      entity,
      calibratedMaps,
      allowUniqueFallback
    );
    const selects = candidates
      .filter((entityId) => entityId.startsWith('select.'))
      .map((entityId) => [entityId, vacuumOptionValues(hass?.states?.[entityId])]);
    const cleaningMode = associatedEntity(
      hass,
      entity,
      selects.filter(([, options]) => options.includes('vac_and_mop')).map(([id]) => id),
      allowUniqueFallback
    );
    const mopMode = associatedEntity(
      hass,
      entity,
      selects.filter(([, options]) =>
        options.includes(DEFAULT_NORMAL_MODE) && options.includes(DEFAULT_THOROUGH_MODE)
      ).map(([id]) => id),
      allowUniqueFallback
    );
    const mopIntensity = associatedEntity(
      hass,
      entity,
      selects.filter(([, options]) =>
        options.includes('high') && options.includes('off')
      ).map(([id]) => id),
      allowUniqueFallback
    );
    const battery = associatedEntity(
      hass,
      entity,
      candidates.filter((entityId) => {
        const state = hass?.states?.[entityId];
        return entityId.startsWith('sensor.') && (
          state?.attributes?.device_class === 'battery' || /batter/i.test(entityId)
        );
      }),
      allowUniqueFallback
    );
    return {
      entity,
      map_entity: mapEntity,
      ...(cleaningMode ? { cleaning_mode_entity: cleaningMode } : {}),
      ...(mopMode ? { mop_mode_entity: mopMode } : {}),
      ...(mopIntensity ? { mop_intensity_entity: mopIntensity } : {}),
      ...(battery ? { battery_entity: battery } : {}),
      border_title: 'vacuum',
      show_state: true,
      show_battery: true,
      show_room_labels: true,
    };
  }

  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._selectedAreaIds = new Set();
    this._roomButtons = [];
    this._roomSignature = '';
    this._imageSource = '';
    this._imageRevision = null;
    this._imageGeneration = 0;
    this._imageLoaded = false;
    this._busyControl = '';
    this._operationError = '';
    this._operationGeneration = 0;
    this._mappingGeneration = 0;
    this._mappingRequestKey = '';
    this._registryEntry = null;
    this._mappingError = false;

    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    this._card = document.createElement('article');
    this._card.className = 'card';
    this._borderTitle = document.createElement('div');
    this._borderTitle.className = 'border-title';
    this._borderTitle.hidden = true;

    this._main = document.createElement('div');
    this._main.className = 'main';
    this._icon = document.createElement('ha-icon');
    this._icon.className = 'icon';
    this._text = document.createElement('div');
    this._text.className = 'text';
    this._name = document.createElement('div');
    this._name.className = 'name';
    this._state = document.createElement('div');
    this._state.className = 'state';
    this._text.append(this._name, this._state);
    this._main.append(this._icon, this._text);

    this._mapFrame = document.createElement('div');
    this._mapFrame.className = 'map-frame';
    this._mapSurface = document.createElement('div');
    this._mapSurface.className = 'map-surface';
    this._mapImage = this._createMapImage();
    this._roomLayer = document.createElement('div');
    this._roomLayer.className = 'room-layer';
    this._mapMessage = document.createElement('div');
    this._mapMessage.className = 'map-message';
    this._mapMessage.textContent = 'karte wird geladen…';
    this._mapSurface.append(this._mapImage, this._roomLayer, this._mapMessage);
    this._mapFrame.append(this._mapSurface);

    this._selectionRow = document.createElement('div');
    this._selectionRow.className = 'selection-row';
    this._selectionSummary = document.createElement('span');
    this._selectionSummary.className = 'selection-summary';
    this._clearSelection = document.createElement('button');
    this._clearSelection.className = 'clear-selection';
    this._clearSelection.type = 'button';
    this._clearSelection.textContent = 'ganze karte';
    this._clearSelection.setAttribute('aria-label', 'Raumauswahl löschen und ganze Karte reinigen');
    this._selectionRow.append(this._selectionSummary, this._clearSelection);

    this._settings = document.createElement('div');
    this._settings.className = 'settings';
    this._settingGrid = document.createElement('div');
    this._settingGrid.className = 'setting-grid';
    this._cleaningControl = this._createSelectControl('reinigungsart', 'cleaning-mode');
    this._fanControl = this._createSelectControl('saugleistung', 'fan-speed');
    this._mopIntensityControl = this._createSelectControl('wischleistung', 'mop-intensity');
    this._settingGrid.append(
      this._cleaningControl.row,
      this._fanControl.row,
      this._mopIntensityControl.row
    );

    this._modeSetting = document.createElement('div');
    this._modeSetting.className = 'setting mode-setting';
    const modeLabel = document.createElement('span');
    modeLabel.className = 'mode-label';
    modeLabel.textContent = 'reinigung';
    this._modeButtons = document.createElement('div');
    this._modeButtons.className = 'mode-buttons';
    this._normal = this._createModeButton('normal', 'normal-mode');
    this._thorough = this._createModeButton('gründlich', 'thorough-mode');
    this._modeButtons.append(this._normal, this._thorough);
    this._modeSetting.append(modeLabel, this._modeButtons);
    this._settingGrid.append(this._modeSetting);

    this._commands = document.createElement('div');
    this._commands.className = 'commands';
    this._start = this._createCommand('mdi:play', 'start', 'start');
    this._start.dataset.primary = 'true';
    this._pause = this._createCommand('mdi:pause', 'pause', 'pause');
    this._dock = this._createCommand('mdi:home-import-outline', 'dock', 'dock');
    this._commands.append(this._start, this._pause, this._dock);
    this._operationStatus = document.createElement('div');
    this._operationStatus.className = 'operation-status';
    this._operationStatus.setAttribute('role', 'status');
    this._operationStatus.setAttribute('aria-live', 'polite');
    this._settings.append(this._settingGrid, this._commands, this._operationStatus);

    this._card.append(
      this._borderTitle,
      this._main,
      this._mapFrame,
      this._selectionRow,
      this._settings
    );
    root.append(style, this._card);

    this._clearSelection.addEventListener('click', () => {
      this._selectedAreaIds.clear();
      this._render();
    });
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    this._invalidateOperations();
    ++this._mappingGeneration;
    this._hass = null;
    this._registryEntry = null;
    this._mappingRequestKey = '';
    ++this._imageGeneration;
    this._mapImage.removeAttribute('src');
    this._imageSource = '';
    this._imageRevision = null;
    this._imageLoaded = false;
  }

  setConfig(config) {
    validateEntity(config, 'entity', 'vacuum', true);
    validateEntity(config, 'map_entity', 'image', true);
    validateEntity(config, 'cleaning_mode_entity', 'select');
    validateEntity(config, 'mop_intensity_entity', 'select');
    validateEntity(config, 'mop_mode_entity', 'select');
    validateEntity(config, 'battery_entity', 'sensor');
    for (const key of ['show_state', 'show_battery', 'show_room_labels']) {
      validateBoolean(config, key);
    }
    for (const key of ['normal_mode', 'thorough_mode', 'name', 'icon']) {
      if (config?.[key] !== undefined && (
        typeof config[key] !== 'string' || !config[key].trim()
      )) {
        throw new Error(`${TAG}: "${key}" must be a non-empty string`);
      }
    }
    const normalMode = config.normal_mode || DEFAULT_NORMAL_MODE;
    const thoroughMode = config.thorough_mode || DEFAULT_THOROUGH_MODE;
    if (normalMode === thoroughMode) {
      throw new Error(`${TAG}: "normal_mode" and "thorough_mode" must differ`);
    }
    validateAppearance(config, TAG, { borderTitle: true, titlePosition: true });
    const identityChanged = this._config && (
      this._config.entity !== config.entity || this._config.map_entity !== config.map_entity
    );
    this._config = { ...config };
    this._invalidateOperations();
    if (identityChanged) this._selectedAreaIds.clear();
    this._resetMapping();
    this._render();
  }

  set hass(hass) {
    const connectionChanged = Boolean(
      this._hass && this._hass.connection !== hass?.connection
    );
    this._hass = hass;
    if (connectionChanged) {
      this._invalidateOperations();
      this._resetMapping();
    }
    this._render();
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  _entity(entityId = this._config?.entity) {
    return this._hass?.states?.[entityId] || null;
  }

  _createMapImage() {
    const image = document.createElement('img');
    image.className = 'map-image';
    image.alt = '';
    image.decoding = 'async';
    return image;
  }

  _loadMapImage(source, revision) {
    const image = this._createMapImage();
    const generation = ++this._imageGeneration;
    const current = () => generation === this._imageGeneration &&
      revision === this._imageRevision && this._mapImage === image;
    image.addEventListener('load', () => {
      if (!current()) return;
      this._imageLoaded = true;
      image.hidden = false;
      this._mapMessage.hidden = true;
      this._renderRoomLayout();
    });
    image.addEventListener('error', () => {
      if (!current()) return;
      this._imageLoaded = false;
      image.hidden = true;
      this._roomLayer.replaceChildren();
      this._roomButtons = [];
      this._mapMessage.hidden = false;
      this._mapMessage.textContent = 'karte nicht verfügbar';
      this._renderSelection();
    });
    this._mapImage.replaceWith(image);
    this._mapImage = image;
    image.src = revisionedMapImageSource(source, revision);
    if (image.complete && image.naturalWidth > 0) {
      this._imageLoaded = true;
      this._mapMessage.hidden = true;
      this._renderRoomLayout();
    }
  }

  _createSelectControl(labelText, focusKey) {
    const row = document.createElement('div');
    row.className = 'setting';
    const label = document.createElement('label');
    const id = `${TAG}-${focusKey}`;
    label.htmlFor = id;
    label.textContent = labelText;
    const select = document.createElement('select');
    select.id = id;
    select.dataset.focusKey = focusKey;
    select.setAttribute('aria-label', labelText);
    row.append(label, select);
    select.addEventListener('change', () => this._changeSelectControl(focusKey, select.value));
    return { row, select, optionsKey: '' };
  }

  _createModeButton(label, focusKey) {
    const button = document.createElement('button');
    button.className = 'mode-button';
    button.type = 'button';
    button.textContent = label;
    button.dataset.focusKey = focusKey;
    button.setAttribute('aria-label', `${label} reinigen`);
    button.addEventListener('click', () => {
      const option = focusKey === 'normal-mode'
        ? this._config?.normal_mode || DEFAULT_NORMAL_MODE
        : this._config?.thorough_mode || DEFAULT_THOROUGH_MODE;
      this._callSelectOption('mop-mode', this._config?.mop_mode_entity, option, focusKey);
    });
    return button;
  }

  _createCommand(icon, label, focusKey) {
    const button = document.createElement('button');
    button.className = 'command';
    button.type = 'button';
    button.dataset.focusKey = focusKey;
    button.setAttribute('aria-label', label);
    const iconElement = document.createElement('ha-icon');
    iconElement.icon = icon;
    const text = document.createElement('span');
    text.textContent = label;
    button.append(iconElement, text);
    button.addEventListener('click', () => {
      if (focusKey === 'start') this._startCleaning();
      else if (focusKey === 'pause') this._callVacuumService('pause', {}, focusKey);
      else this._callVacuumService('return_to_base', {}, focusKey);
    });
    return button;
  }

  _render() {
    if (!this._config) return;
    applyAccentColor(this, this._config.accent_color);
    const entity = this._entity();
    const attributes = entity?.attributes || {};
    const unavailable = isVacuumUnavailable(entity);
    const state = unavailable ? 'unavailable' : entity.state;
    const name = this._config.name || attributes.friendly_name || this._config.entity;
    const borderTitle = this._config.border_title?.trim() || '';

    this.dataset.borderTitle = String(Boolean(borderTitle));
    this._borderTitle.hidden = !borderTitle;
    this._borderTitle.dataset.titlePosition = this._config.title_position || 'left';
    this._borderTitle.textContent = borderTitle;
    this._card.dataset.state = state;
    this._card.setAttribute('aria-busy', String(Boolean(this._busyControl)));
    this._card.setAttribute('aria-label', `${name}: ${vacuumStateLabel(state)}`);
    this._icon.icon = this._config.icon || attributes.icon || 'mdi:robot-vacuum';
    this._name.textContent = name;
    this._renderState(entity);
    this._renderMap();
    this._renderControls(entity, unavailable);
    this._ensureRegistryOptions();
  }

  _renderState(entity) {
    const values = [];
    if (this._config.show_state !== false) {
      const formatted = entity
        ? this._hass?.formatEntityState?.(entity) || entity.state
        : 'unavailable';
      values.push(formatted === entity?.state ? vacuumStateLabel(formatted) : String(formatted));
    }
    if (this._config.show_battery !== false && this._config.battery_entity) {
      const battery = this._entity(this._config.battery_entity);
      if (battery && !['unknown', 'unavailable'].includes(battery.state)) {
        const unit = battery.attributes?.unit_of_measurement || '%';
        values.push(`${battery.state}${unit}`);
      }
    }
    this._state.hidden = values.length === 0;
    this._state.textContent = values.join(' · ').toLocaleLowerCase();
  }

  _renderMap() {
    const mapEntity = this._entity(this._config.map_entity);
    const unavailable = !mapEntity || ['unavailable', 'unknown'].includes(mapEntity.state);
    const source = unavailable ? '' : safeMapImageSource(mapEntity.attributes?.entity_picture);
    const revision = source ? mapImageRevision(mapEntity, source) : '';
    if (source !== this._imageSource || revision !== this._imageRevision) {
      this._imageSource = source;
      this._imageRevision = revision;
      this._imageLoaded = false;
      this._roomSignature = '';
      this._roomLayer.replaceChildren();
      this._roomButtons = [];
      this._mapMessage.hidden = false;
      if (source) {
        this._mapMessage.textContent = 'karte wird geladen…';
        this._loadMapImage(source, revision);
      } else {
        ++this._imageGeneration;
        this._mapImage.removeAttribute('src');
        this._mapImage.hidden = true;
        this._mapMessage.textContent = 'karte nicht verfügbar';
      }
    }
    if (this._imageLoaded) this._renderRoomLayout();
  }

  _renderRoomLayout() {
    if (!this._config || !this._hass || !this._imageLoaded) return;
    const mapEntity = this._entity(this._config.map_entity);
    if (!mapEntity) return;
    const projection = createMapProjection(mapEntity.attributes?.calibration_points);
    const width = this._mapImage.naturalWidth;
    const height = this._mapImage.naturalHeight;
    const modelHass = this._registryEntry
      ? {
        ...this._hass,
        entities: {
          ...(this._hass.entities || {}),
          [this._config.entity]: this._registryEntry,
        },
      }
      : this._hass;
    const rooms = vacuumRoomModel(modelHass, this._config.entity, mapEntity)
      .map((room) => ({
        ...room,
        rectangle: projectRoomRectangle(room, projection, width, height),
      }))
      .filter((room) => room.rectangle)
      .sort((left, right) => {
        const leftArea = left.rectangle.width * left.rectangle.height;
        const rightArea = right.rectangle.width * right.rectangle.height;
        return rightArea - leftArea;
      });
    const signature = JSON.stringify({
      width,
      height,
      labels: this._config.show_room_labels !== false,
      rooms: rooms.map((room) => [
        room.id,
        room.areaId,
        room.areaName,
        room.rectangle.left,
        room.rectangle.top,
        room.rectangle.width,
        room.rectangle.height,
      ]),
    });
    if (signature !== this._roomSignature) {
      this._roomSignature = signature;
      this._roomLayer.replaceChildren();
      this._roomButtons = [];
      rooms.forEach((room, index) => {
        const button = document.createElement('button');
        button.className = 'room-zone';
        button.type = 'button';
        button.style.left = `${room.rectangle.left + room.rectangle.width / 2}%`;
        button.style.top = `${room.rectangle.top + room.rectangle.height / 2}%`;
        button.style.width = `${room.rectangle.width}%`;
        button.style.height = `${room.rectangle.height}%`;
        button.dataset.focusKey = `room-${index}`;
        button.setAttribute('aria-label', `${room.areaName} auswählen`);
        const label = document.createElement('span');
        label.className = 'room-label';
        label.hidden = this._config.show_room_labels === false;
        label.textContent = room.areaName;
        button.append(label);
        button.addEventListener('click', () => this._toggleRoom(room.areaId));
        this._roomLayer.append(button);
        this._roomButtons.push({ button, room });
      });
    }
    this._roomLayer.hidden = rooms.length === 0;
    this._mapMessage.hidden = true;
    this._renderSelection();
  }

  _renderSelection() {
    const entity = this._entity();
    const unavailable = isVacuumUnavailable(entity);
    const canCleanArea = vacuumSupports(entity, VACUUM_SUPPORT_CLEAN_AREA);
    const availableAreaIds = new Set(
      this._roomButtons.map(({ room }) => room.areaId).filter(Boolean)
    );
    for (const areaId of [...this._selectedAreaIds]) {
      if (!availableAreaIds.has(areaId)) this._selectedAreaIds.delete(areaId);
    }
    for (const { button, room } of this._roomButtons) {
      const selected = Boolean(room.areaId && this._selectedAreaIds.has(room.areaId));
      button.disabled = unavailable || !canCleanArea || !room.areaId || Boolean(this._busyControl);
      button.setAttribute('aria-pressed', String(selected));
    }
    const selectedNames = [];
    for (const areaId of this._selectedAreaIds) {
      const room = this._roomButtons.find((entry) => entry.room.areaId === areaId)?.room;
      selectedNames.push(room?.areaName || areaId);
    }
    const mappedCount = availableAreaIds.size;
    if (!this._roomButtons.length) {
      this._selectionSummary.textContent = 'raumdaten oder kalibrierung nicht verfügbar';
    } else if (!mappedCount || this._mappingError) {
      this._selectionSummary.textContent = 'segmente zuerst ha-räumen zuordnen';
    } else if (selectedNames.length) {
      this._selectionSummary.textContent = `auswahl: ${selectedNames.join(', ')}`;
    } else {
      this._selectionSummary.textContent = 'auswahl: gesamte karte';
    }
    this._clearSelection.hidden = this._selectedAreaIds.size === 0;
  }

  _toggleRoom(areaId) {
    if (!areaId || this._busyControl) return;
    if (this._selectedAreaIds.has(areaId)) this._selectedAreaIds.delete(areaId);
    else this._selectedAreaIds.add(areaId);
    this._render();
  }

  _renderControls(entity, unavailable) {
    const cleaningEntity = this._entity(this._config.cleaning_mode_entity);
    const mopIntensityEntity = this._entity(this._config.mop_intensity_entity);
    const mopModeEntity = this._entity(this._config.mop_mode_entity);
    const busy = Boolean(this._busyControl);

    const cleaningOptions = vacuumOptionValues(cleaningEntity);
    this._syncSelect(this._cleaningControl, cleaningOptions, cleaningEntity?.state);
    this._cleaningControl.row.hidden = !this._config.cleaning_mode_entity || !cleaningOptions.length;
    this._cleaningControl.select.disabled = unavailable || busy ||
      ['unknown', 'unavailable'].includes(cleaningEntity?.state);

    const fanOptions = Array.isArray(entity?.attributes?.fan_speed_list)
      ? entity.attributes.fan_speed_list.filter((value) => typeof value === 'string')
      : [];
    this._syncSelect(this._fanControl, fanOptions, entity?.attributes?.fan_speed);
    this._fanControl.row.hidden = !fanOptions.length || !vacuumSupports(entity, VACUUM_SUPPORT_FAN_SPEED);
    this._fanControl.select.disabled = unavailable || busy;

    const mopIntensityOptions = vacuumOptionValues(mopIntensityEntity);
    this._syncSelect(this._mopIntensityControl, mopIntensityOptions, mopIntensityEntity?.state);
    this._mopIntensityControl.row.hidden = !this._config.mop_intensity_entity ||
      !mopIntensityOptions.length;
    this._mopIntensityControl.select.disabled = unavailable || busy ||
      ['unknown', 'unavailable'].includes(mopIntensityEntity?.state);

    const normalMode = this._config.normal_mode || DEFAULT_NORMAL_MODE;
    const thoroughMode = this._config.thorough_mode || DEFAULT_THOROUGH_MODE;
    const mopModeOptions = vacuumOptionValues(mopModeEntity);
    const hasModes = mopModeOptions.includes(normalMode) && mopModeOptions.includes(thoroughMode);
    const usesMop = cleaningModeUsesMop(cleaningEntity?.state);
    this._modeSetting.hidden = !this._config.mop_mode_entity || !hasModes;
    this._normal.dataset.active = String(stateMatches(mopModeEntity, [normalMode]));
    this._thorough.dataset.active = String(stateMatches(mopModeEntity, [thoroughMode]));
    this._normal.setAttribute('aria-pressed', this._normal.dataset.active);
    this._thorough.setAttribute('aria-pressed', this._thorough.dataset.active);
    this._normal.disabled = unavailable || busy || !usesMop;
    this._thorough.disabled = unavailable || busy || !usesMop;

    const state = entity?.state || 'unavailable';
    const startFeature = state !== 'paused' && this._selectedAreaIds.size > 0
      ? VACUUM_SUPPORT_CLEAN_AREA
      : VACUUM_SUPPORT_START;
    this._start.disabled = unavailable || busy || state === 'cleaning' || state === 'returning' ||
      !vacuumSupports(entity, startFeature);
    this._pause.disabled = unavailable || busy || state !== 'cleaning' ||
      !vacuumSupports(entity, VACUUM_SUPPORT_PAUSE);
    this._dock.disabled = unavailable || busy || ['docked', 'returning'].includes(state) ||
      !vacuumSupports(entity, VACUUM_SUPPORT_RETURN_HOME);
    this._start.querySelector('span').textContent = state === 'paused' ? 'fortsetzen' : 'start';

    this._operationStatus.dataset.error = String(Boolean(this._operationError));
    this._operationStatus.textContent = this._operationError ||
      (this._busyControl ? 'befehl wird ausgeführt…' : '');
    this._renderSelection();
  }

  _syncSelect(control, options, currentValue) {
    const values = [...new Set(options.map(String).filter(Boolean))];
    if (currentValue && !values.includes(currentValue)) values.push(currentValue);
    const key = JSON.stringify(values);
    if (key !== control.optionsKey) {
      control.optionsKey = key;
      const optionElements = values.map((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = vacuumOptionLabel(value);
        return option;
      });
      control.select.replaceChildren(...optionElements);
    }
    if (currentValue && values.includes(currentValue)) control.select.value = currentValue;
  }

  _changeSelectControl(focusKey, value) {
    if (focusKey === 'cleaning-mode') {
      this._callSelectOption(
        focusKey,
        this._config?.cleaning_mode_entity,
        value,
        focusKey
      );
    } else if (focusKey === 'mop-intensity') {
      this._callSelectOption(
        focusKey,
        this._config?.mop_intensity_entity,
        value,
        focusKey
      );
    } else {
      this._runService(
        focusKey,
        'vacuum',
        'set_fan_speed',
        { fan_speed: value },
        { entity_id: this._config.entity },
        focusKey
      );
    }
  }

  _callSelectOption(control, entityId, option, focusKey) {
    if (!entityId || !option) return;
    this._runService(
      control,
      'select',
      'select_option',
      { option },
      { entity_id: entityId },
      focusKey
    );
  }

  _startCleaning() {
    const entity = this._entity();
    if (!entity || this._busyControl) return;
    if (entity.state === 'paused' || this._selectedAreaIds.size === 0) {
      this._callVacuumService('start', {}, 'start');
      return;
    }
    if (!vacuumSupports(entity, VACUUM_SUPPORT_CLEAN_AREA)) return;
    this._callVacuumService(
      'clean_area',
      { cleaning_area_id: [...this._selectedAreaIds] },
      'start'
    );
  }

  _callVacuumService(service, data, focusKey) {
    this._runService(
      focusKey,
      'vacuum',
      service,
      data,
      { entity_id: this._config.entity },
      focusKey
    );
  }

  async _runService(control, domain, service, data, target, focusKey) {
    if (!this._hass || !this._config || this._busyControl) return;
    const hass = this._hass;
    const connection = hass.connection;
    const entityId = this._config.entity;
    const generation = ++this._operationGeneration;
    this._busyControl = control;
    this._operationError = '';
    this._render();
    try {
      await hass.callService(domain, service, data, target);
      if (!this._operationCurrent(generation, connection, entityId)) return;
      this._busyControl = '';
      this._render();
      this._restoreFocusKey(focusKey);
    } catch (error) {
      if (!this._operationCurrent(generation, connection, entityId)) return;
      this._busyControl = '';
      this._operationError = String(error?.message || 'command failed').toLocaleLowerCase();
      this._render();
      this._restoreFocusKey(focusKey);
    }
  }

  _operationCurrent(generation, connection, entityId) {
    return generation === this._operationGeneration &&
      this._hass?.connection === connection &&
      this._config?.entity === entityId;
  }

  _invalidateOperations() {
    ++this._operationGeneration;
    this._busyControl = '';
    this._operationError = '';
  }

  _captureFocusKey() {
    return this.shadowRoot.activeElement?.dataset?.focusKey || '';
  }

  _restoreFocusKey(key) {
    if (!key) return;
    const target = [...this.shadowRoot.querySelectorAll('[data-focus-key]')]
      .find((element) => element.dataset.focusKey === key && !element.disabled);
    target?.focus();
  }

  _resetMapping() {
    ++this._mappingGeneration;
    this._registryEntry = null;
    this._mappingError = false;
    this._mappingRequestKey = '';
    this._roomSignature = '';
  }

  _ensureRegistryOptions() {
    if (!this._hass || !this._config) return;
    const directOptions = this._hass.entities?.[this._config.entity]?.options;
    if (directOptions?.vacuum?.area_mapping || directOptions?.area_mapping) {
      this._registryEntry = null;
      this._mappingError = false;
      return;
    }
    if (typeof this._hass.callWS !== 'function') {
      this._mappingError = true;
      return;
    }
    const connection = this._hass.connection;
    const entityId = this._config.entity;
    const requestKey = `${entityId}:${String(connection)}`;
    if (this._mappingRequestKey === requestKey) return;
    this._mappingRequestKey = requestKey;
    const hass = this._hass;
    const generation = ++this._mappingGeneration;
    Promise.resolve(hass.callWS({
      type: 'config/entity_registry/get',
      entity_id: entityId,
    })).then((entry) => {
      if (
        generation !== this._mappingGeneration ||
        this._hass?.connection !== connection ||
        this._config?.entity !== entityId
      ) return;
      this._registryEntry = entry && typeof entry === 'object' ? entry : null;
      this._mappingError = !this._registryEntry;
      this._roomSignature = '';
      this._renderRoomLayout();
    }).catch(() => {
      if (
        generation !== this._mappingGeneration ||
        this._hass?.connection !== connection ||
        this._config?.entity !== entityId
      ) return;
      this._registryEntry = null;
      this._mappingError = true;
      this._roomSignature = '';
      this._renderRoomLayout();
    });
  }
}

defineElement(TAG, TerminalVacuumCard);
registerCard({
  type: TAG,
  name: 'Terminal Vacuum Card',
  description: 'A terminal-style vacuum control with selectable map rooms.',
  documentationURL: DOCUMENTATION_URL,
});
