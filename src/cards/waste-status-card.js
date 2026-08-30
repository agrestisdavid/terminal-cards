import { TerminalWasteCard } from './waste-card.js';
import { defineElement } from '../shared/ha.js';

const LEGACY_TAG = 'terminal-waste-status-card';

// Compatibility alias for dashboards created with Terminal Cards v0.15.0.
// Keep it out of window.customCards so new cards use custom:terminal-waste-card.
export class TerminalWasteStatusCard extends TerminalWasteCard {}

defineElement(LEGACY_TAG, TerminalWasteStatusCard);
