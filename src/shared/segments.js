export const SEGMENT_SIZE = 7;
export const MIN_SEGMENT_GAP = 4;
export const MAX_SEGMENTS = 40;

export function segmentCountForWidth(width) {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.max(
    1,
    Math.min(
      MAX_SEGMENTS,
      Math.floor((width + MIN_SEGMENT_GAP) / (SEGMENT_SIZE + MIN_SEGMENT_GAP))
    )
  );
}

export function hueSegmentColor(index, count) {
  const progress = index / Math.max(1, count - 1);
  return `hsl(${progress * 360} 85% 65%)`;
}

export function temperatureSegmentColor(index, count) {
  const progress = index / Math.max(1, count - 1);
  const warm = [250, 179, 135];
  const cool = [137, 180, 250];
  const color = warm.map((channel, channelIndex) =>
    Math.round(channel + (cool[channelIndex] - channel) * progress)
  );
  return `rgb(${color.join(' ')})`;
}
