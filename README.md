# Terminal Cards

Terminal-style Lovelace cards for Home Assistant, inspired by Herdr panes: square 1 px borders, monospace labels embedded in the top border, and theme-aware state colors.

## Cards

### `custom:terminal-card-wrapper`

Frames arbitrary Lovelace child cards with a terminal-style title embedded in its top border. Child cards are vertical by default; set `columns` for a grid. The visual editor can add, configure, reorder, and remove child cards without YAML.

```yaml
type: custom:terminal-card-wrapper
title: kitchen
columns: 2
cards:
  - type: tile
    entity: light.kitchen
  - type: tile
    entity: sensor.kitchen_temperature
```

### `custom:terminal-light-card`

A compact light card with terminal state colors and an optional brightness control. Its border is continuous: unlike the wrapper, the Light Card deliberately has **no title embedded in the border**. Its name is shown inside the card.

```yaml
type: custom:terminal-light-card
entity: light.kitchen
name: ceiling light
icon: mdi:ceiling-light
show_state: true
show_brightness: true
show_more_info: true
tap_action:
  action: toggle
hold_action:
  action: more-info
```

All options are available in Home Assistant's visual card editor. The entity selector only offers `light.*` entities; action fields use Home Assistant's native action editor.

## Installation with HACS

1. Open HACS → **Custom repositories**.
2. Add `https://github.com/agrestisdavid/terminal-cards` as category **Dashboard**.
3. Install **Terminal Cards**.
4. Hard-refresh Home Assistant (`Ctrl+Shift+R`).

HACS loads the release asset `terminal-cards.js`; no inline `data:` resource is needed. Both cards appear in Home Assistant's card picker and provide graphical configuration.

## Development

```bash
npm install
npm test
```

The production bundle is written to `dist/terminal-cards.js`.

## Theme variables

The bundle uses Home Assistant theme variables with Herdr/Catppuccin Mocha fallbacks:

- `--card-background-color`
- `--primary-text-color`
- `--secondary-text-color`
- `--accent-color`
- `--error-color`

## License

MIT
