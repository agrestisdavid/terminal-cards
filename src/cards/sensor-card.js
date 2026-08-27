import { TerminalEntityCard } from '../shared/entity-card.js';
import {
  DOCUMENTATION_URL,
  defineElement,
  registerCard,
} from '../shared/ha.js';

const TAG = 'terminal-sensor-card';

export class TerminalSensorCard extends TerminalEntityCard {
  static cardName = TAG;
  static entityDomains = ['sensor', 'binary_sensor'];
  static entityLabel = 'Sensor entity';
  static defaultIcon = 'mdi:gauge';
  static defaultTapAction = { action: 'more-info' };
  static defaultHoldAction = { action: 'none' };

  static isActive(entity) {
    return entity?.entity_id?.startsWith('binary_sensor.') && entity.state === 'on';
  }

  static iconForEntity(entity) {
    if (entity?.entity_id?.startsWith('binary_sensor.')) {
      return entity.state === 'on' ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank';
    }
    return this.defaultIcon;
  }

  static formatState(hass, entity) {
    const formatted = String(hass?.formatEntityState?.(entity) || entity.state);
    return entity.entity_id?.startsWith('binary_sensor.')
      ? formatted.toLocaleLowerCase()
      : formatted;
  }
}

defineElement(TAG, TerminalSensorCard);
registerCard({
  type: TAG,
  name: 'Terminal Sensor Card',
  description: 'A terminal-style card for sensor and binary sensor states.',
  documentationURL: DOCUMENTATION_URL,
});
