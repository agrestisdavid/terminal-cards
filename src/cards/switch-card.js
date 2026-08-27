import { TerminalEntityCard } from '../shared/entity-card.js';
import {
  DOCUMENTATION_URL,
  defineElement,
  registerCard,
} from '../shared/ha.js';

const TAG = 'terminal-switch-card';

export class TerminalSwitchCard extends TerminalEntityCard {
  static cardName = TAG;
  static entityDomains = ['switch', 'input_boolean'];
  static entityLabel = 'Switch or input boolean entity';
  static defaultIcon = 'mdi:toggle-switch-off-outline';
  static defaultTapAction = { action: 'toggle' };
  static defaultHoldAction = { action: 'more-info' };

  static isActive(entity) {
    return entity?.state === 'on';
  }

  static iconForEntity(entity) {
    return entity?.state === 'on' ? 'mdi:toggle-switch' : this.defaultIcon;
  }
}

defineElement(TAG, TerminalSwitchCard);
registerCard({
  type: TAG,
  name: 'Terminal Switch Card',
  description: 'A terminal-style switch control with native Home Assistant actions.',
  documentationURL: DOCUMENTATION_URL,
});
