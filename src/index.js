import './editors/wrapper-editor.js';
import './cards/wrapper-card.js';
import './cards/title-card.js';
import './cards/light-card.js';
import './cards/switch-card.js';
import './cards/sensor-card.js';
import './cards/calendar-card.js';
import './cards/waste-card.js';
import './cards/waste-status-card.js';
import './cards/alarm-card.js';
import './cards/shutter-card.js';
import './cards/vacuum-card.js';
import './cards/navigation-card.js';

const VERSION =
  typeof __TERMINAL_CARDS_VERSION__ === 'string'
    ? __TERMINAL_CARDS_VERSION__
    : 'dev';

console.info(
  `%c TERMINAL-CARDS %c v${VERSION} `,
  'background:#89b4fa;color:#11111b;font-weight:700;',
  'background:#181825;color:#cdd6f4;'
);
