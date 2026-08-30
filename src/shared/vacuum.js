export const VACUUM_SUPPORT_PAUSE = 4;
export const VACUUM_SUPPORT_RETURN_HOME = 16;
export const VACUUM_SUPPORT_FAN_SPEED = 32;
export const VACUUM_SUPPORT_START = 8192;
export const VACUUM_SUPPORT_CLEAN_AREA = 16384;

const OPTION_LABELS = Object.freeze({
  vacuum: 'saugen',
  vac_and_mop: 'saugen + wischen',
  mop: 'wischen',
  quiet: 'leise',
  balanced: 'ausgewogen',
  turbo: 'turbo',
  max: 'maximal',
  max_plus: 'max+',
  off: 'aus',
  low: 'niedrig',
  medium: 'mittel',
  high: 'hoch',
  standard: 'normal',
  deep: 'gründlich',
  deep_plus: 'sehr gründlich',
  fast: 'schnell',
  smart_mode: 'smart',
  custom: 'benutzerdefiniert',
  custom_water_flow: 'eigener wasserfluss',
});

const STATE_LABELS = Object.freeze({
  docked: 'angedockt',
  cleaning: 'reinigt',
  paused: 'pausiert',
  returning: 'fährt zur station',
  idle: 'bereit',
  error: 'fehler',
  unavailable: 'nicht verfügbar',
  unknown: 'unbekannt',
});

function finitePoint(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function normalizeToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function segmentNumber(value) {
  const match = String(value ?? '').match(/(?:^|_)(\d+)$/);
  return match ? String(Number(match[1])) : '';
}

function vacuumRegistryOptions(hass, entityId) {
  const options = hass?.entities?.[entityId]?.options;
  if (!options || typeof options !== 'object') return null;
  const nested = options.vacuum;
  return nested && typeof nested === 'object' ? nested : options;
}

function mapGroupHint(mapEntity, segments) {
  const attributes = mapEntity?.attributes || {};
  const source = normalizeToken(
    attributes.map_name || attributes.friendly_name || mapEntity?.entity_id
  );
  const groups = [...new Set(
    segments.map((segment) => String(segment?.group || '').trim()).filter(Boolean)
  )];
  const matches = groups.filter((group) => source.includes(normalizeToken(group)));
  return matches.length === 1 ? matches[0] : '';
}

function uniqueCandidate(candidates) {
  const byId = new Map();
  for (const candidate of candidates) {
    const id = String(candidate?.id || '');
    if (id) byId.set(id, candidate);
  }
  return byId.size === 1 ? [...byId.values()][0] : null;
}

function matchRoomSegment(room, segments, groupHint) {
  const roomName = normalizeToken(room.name);
  const roomNumber = String(Number(room.number ?? room.id));
  const sameGroup = (segment) => !groupHint || segment?.group === groupHint;
  const sameName = (segment) => roomName && normalizeToken(segment?.name) === roomName;
  const sameNumber = (segment) => roomNumber && segmentNumber(segment?.id) === roomNumber;
  return uniqueCandidate(segments.filter((segment) => sameGroup(segment) && sameName(segment))) ||
    uniqueCandidate(segments.filter(sameName)) ||
    uniqueCandidate(segments.filter((segment) => sameGroup(segment) && sameNumber(segment))) ||
    uniqueCandidate(segments.filter(sameNumber));
}

export function vacuumOptionLabel(value) {
  const key = String(value ?? '');
  return OPTION_LABELS[key] || key.replaceAll('_', ' ').toLocaleLowerCase();
}

export function vacuumStateLabel(value) {
  const key = String(value ?? 'unavailable');
  return STATE_LABELS[key] || key.replaceAll('_', ' ').toLocaleLowerCase();
}

export function vacuumOptionValues(entity) {
  if (!entity || !Array.isArray(entity.attributes?.options)) return [];
  return entity.attributes.options
    .filter((option) => typeof option === 'string' && option.trim())
    .map((option) => option.trim());
}

export function isVacuumUnavailable(entity) {
  return !entity || ['unavailable', 'unknown', 'error'].includes(entity.state);
}

export function vacuumSupports(entity, feature) {
  return ((Number(entity?.attributes?.supported_features) || 0) & feature) !== 0;
}

export function cleaningModeUsesMop(mode) {
  return mode !== 'vacuum';
}

export function safeMapImageSource(value) {
  const source = typeof value === 'string' ? value.trim() : '';
  if (!source || source.startsWith('//')) return '';
  if (/^data:image\//i.test(source) || /^blob:/i.test(source)) return source;
  try {
    const url = new URL(source, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_error) {
    return '';
  }
}

export function mapImageRevision(mapEntity, source) {
  return [
    source,
    mapEntity?.state,
    mapEntity?.last_updated,
    mapEntity?.last_changed,
  ].map((value) => String(value ?? '')).join('\n');
}

export function revisionedMapImageSource(source, revision) {
  if (!source || /^data:image\//i.test(source) || /^blob:/i.test(source)) return source;
  try {
    const url = new URL(source, window.location.href);
    let hash = 2166136261;
    for (const character of String(revision ?? '')) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    url.searchParams.set('_terminal_cards_rev', (hash >>> 0).toString(36));
    return url.href;
  } catch (_error) {
    return source;
  }
}

export function createMapProjection(calibrationPoints) {
  if (!Array.isArray(calibrationPoints) || calibrationPoints.length < 3) return null;
  const points = calibrationPoints
    .map((entry) => ({ vacuum: finitePoint(entry?.vacuum), map: finitePoint(entry?.map) }))
    .filter((entry) => entry.vacuum && entry.map)
    .slice(0, 12);
  for (let first = 0; first < points.length - 2; first += 1) {
    for (let second = first + 1; second < points.length - 1; second += 1) {
      for (let third = second + 1; third < points.length; third += 1) {
        const origin = points[first];
        const one = points[second];
        const two = points[third];
        const v1x = one.vacuum.x - origin.vacuum.x;
        const v1y = one.vacuum.y - origin.vacuum.y;
        const v2x = two.vacuum.x - origin.vacuum.x;
        const v2y = two.vacuum.y - origin.vacuum.y;
        const determinant = v1x * v2y - v1y * v2x;
        if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.000001) continue;
        const m1x = one.map.x - origin.map.x;
        const m1y = one.map.y - origin.map.y;
        const m2x = two.map.x - origin.map.x;
        const m2y = two.map.y - origin.map.y;
        return (xValue, yValue) => {
          const x = Number(xValue);
          const y = Number(yValue);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          const dx = x - origin.vacuum.x;
          const dy = y - origin.vacuum.y;
          const alpha = (dx * v2y - dy * v2x) / determinant;
          const beta = (v1x * dy - v1y * dx) / determinant;
          const mapX = origin.map.x + alpha * m1x + beta * m2x;
          const mapY = origin.map.y + alpha * m1y + beta * m2y;
          return Number.isFinite(mapX) && Number.isFinite(mapY)
            ? { x: mapX, y: mapY }
            : null;
        };
      }
    }
  }
  return null;
}

export function projectRoomRectangle(room, projection, imageWidth, imageHeight) {
  const x0 = Number(room?.x0);
  const y0 = Number(room?.y0);
  const x1 = Number(room?.x1);
  const y1 = Number(room?.y1);
  const width = Number(imageWidth);
  const height = Number(imageHeight);
  if (
    !projection ||
    ![x0, y0, x1, y1, width, height].every(Number.isFinite) ||
    x0 === x1 || y0 === y1 || width <= 0 || height <= 0
  ) return null;
  const corners = [
    projection(x0, y0),
    projection(x0, y1),
    projection(x1, y0),
    projection(x1, y1),
  ];
  if (corners.some((point) => !point)) return null;
  const rawLeft = Math.min(...corners.map((point) => point.x));
  const rawRight = Math.max(...corners.map((point) => point.x));
  const rawTop = Math.min(...corners.map((point) => point.y));
  const rawBottom = Math.max(...corners.map((point) => point.y));
  if (rawRight <= 0 || rawBottom <= 0 || rawLeft >= width || rawTop >= height) return null;
  const left = Math.max(0, Math.min(width, rawLeft));
  const right = Math.max(0, Math.min(width, rawRight));
  const top = Math.max(0, Math.min(height, rawTop));
  const bottom = Math.max(0, Math.min(height, rawBottom));
  if (right - left < 1 || bottom - top < 1) return null;
  return {
    left: (left / width) * 100,
    top: (top / height) * 100,
    width: ((right - left) / width) * 100,
    height: ((bottom - top) / height) * 100,
  };
}

export function vacuumRoomModel(hass, vacuumEntityId, mapEntity) {
  const rawRooms = mapEntity?.attributes?.rooms;
  const rooms = rawRooms && typeof rawRooms === 'object'
    ? Object.entries(rawRooms).map(([id, value]) => ({
      ...value,
      id: String(id),
      number: value?.number ?? id,
      name: String(value?.name || id),
    }))
    : [];
  const options = vacuumRegistryOptions(hass, vacuumEntityId);
  const areaMapping = options?.area_mapping;
  const segments = Array.isArray(options?.last_seen_segments)
    ? options.last_seen_segments.filter((segment) => segment && typeof segment === 'object')
    : [];
  if (!areaMapping || typeof areaMapping !== 'object' || !segments.length) {
    return rooms.map((room) => ({ ...room, areaId: '', areaName: room.name, segmentId: '' }));
  }
  const segmentAreas = new Map();
  for (const [areaId, rawSegmentIds] of Object.entries(areaMapping)) {
    const segmentIds = Array.isArray(rawSegmentIds) ? rawSegmentIds : [rawSegmentIds];
    for (const segmentIdValue of segmentIds) {
      const segmentId = String(segmentIdValue ?? '');
      if (!segmentId) continue;
      if (!segmentAreas.has(segmentId)) segmentAreas.set(segmentId, []);
      segmentAreas.get(segmentId).push(areaId);
    }
  }
  const groupHint = mapGroupHint(mapEntity, segments);
  return rooms.map((room) => {
    const segment = matchRoomSegment(room, segments, groupHint);
    const areaIds = segment ? [...new Set(segmentAreas.get(String(segment.id)) || [])] : [];
    const areaId = areaIds.length === 1 ? areaIds[0] : '';
    const areaName = areaId
      ? String(hass?.areas?.[areaId]?.name || room.name)
      : room.name;
    return {
      ...room,
      areaId,
      areaName,
      segmentId: segment ? String(segment.id) : '',
    };
  });
}
