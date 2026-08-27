# Terminal Cards

Terminal-style Lovelace cards for Home Assistant, inspired by Herdr panes: square 1 px borders, monospace labels embedded in the top border, and theme-aware state colors.

![Terminal Cards preview](docs/terminal-cards-preview.png)

## Cards

### `custom:terminal-card-wrapper`

Frames arbitrary Lovelace child cards with a terminal-style title embedded in its top border. Child cards are vertical by default; set `columns` for a grid. Children in the same grid row stretch to an equal height. The native-style visual editor can add, configure, reorder, and remove child cards without YAML.

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

A compact light card with terminal state colors and responsive square controls for brightness, hue, and color temperature when the selected light supports them. The square three-dot button expands or collapses those controls. Its border is continuous: unlike the wrapper, the Light Card deliberately has **no title embedded in the border**. Its name is shown inside the card.

```yaml
type: custom:terminal-light-card
entity: light.kitchen
name: ceiling light
icon: mdi:ceiling-light
show_state: true
show_brightness: true
show_hue: true
show_color_temp: true
use_light_color: true
show_controls: true
controls_expanded: false
tap_action:
  action: toggle
hold_action:
  action: more-info
```

All options are available through Home Assistant-native visual form controls. The entity selector only offers `light.*` entities; action fields use Home Assistant's native action editor. The number of square segments adapts automatically to the rendered card width. With `use_light_color`, the active RGB/HS color or color temperature drives the icon and border color.

### `custom:terminal-shutter-card`

A capability-aware control for `cover.*` entities. The square controls button reveals only the functions supported by the selected shutter or blind: open, stop, close, position, and tilt position.

```yaml
type: custom:terminal-shutter-card
entity: cover.office_blind
name: office blind
icon: mdi:blinds-horizontal
show_state: true
show_controls: true
show_position: true
show_tilt: true
controls_expanded: false
```

### `custom:terminal-navigation-card`

An internal Home Assistant navigation card. `variant` switches between a continuous border and the Wrapper-style name embedded in the top border. The visual editor uses Home Assistant's native navigation-path picker.

```yaml
type: custom:terminal-navigation-card
name: kitchen
navigation_path: /dashboard-test/kitchen
icon: mdi:fridge
variant: continuous # or: pane
show_path: true
```

## Installation with HACS

1. Open HACS → **Custom repositories**.
2. Add `https://github.com/agrestisdavid/terminal-cards` as category **Dashboard**.
3. Install **Terminal Cards**.
4. Hard-refresh Home Assistant (`Ctrl+Shift+R`).

HACS loads the release asset `terminal-cards.js`; no inline `data:` resource is needed. All four cards appear in Home Assistant's card picker and provide graphical configuration.

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
