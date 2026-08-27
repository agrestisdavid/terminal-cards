# Terminal Cards

Terminal-style Lovelace cards for Home Assistant, inspired by Herdr panes: square 1 px borders, monospace labels embedded in the top border, and theme-aware state colors.

![Terminal Cards preview](docs/terminal-cards-preview.png)

## Cards

### `custom:terminal-card-wrapper`

Frames arbitrary Lovelace child cards with a terminal-style title embedded in its top border. Child cards have matching 18 px top and bottom spacing. They are vertical by default; set `columns` for a grid. Children in the same grid row stretch to an equal height. When the final grid row contains only one card, that card automatically spans the complete row. An optional formatted entity state or reactive template result can be embedded in any of the four frame corners. The native-style visual editor can add, configure, reorder, and remove child cards without YAML; it lazily loads Home Assistant's native card picker when necessary instead of requiring the editor to be reopened.

```yaml
type: custom:terminal-card-wrapper
title: kitchen
title_position: right
accent_color: blue
entity: sensor.kitchen_temperature
state_template: "{{ states(config.entity) }} °C"
state_position: bottom-right
columns: 2
cards:
  - type: tile
    entity: light.kitchen
  - type: tile
    entity: sensor.kitchen_temperature
```

### `custom:terminal-title-card`

A compact terminal heading frame for dashboard sections. Its large title remains embedded slightly inside the upper border and can be positioned left or right. Font size is configurable from 14 to 48 px. An optional `subtitle` accepts Markdown and reactive Home Assistant templates in the same field; rendered template output is passed to Home Assistant's Markdown component. With a left-aligned title, the subtitle uses the same text inset and sits compactly with equal vertical space between the title and lower border. Right-aligned titles retain the centered subtitle layout. Like the Wrapper, TitleCard can embed a formatted entity state or reactive template result in any frame corner without overlapping its title.

```yaml
type: custom:terminal-title-card
title: home status
subtitle: "**power:** {{ states('sensor.house_power') }} W"
entity: sensor.house_power
state_template: "{{ states(config.entity) }} W"
state_position: bottom-right
font_size: 28
title_position: left
accent_color: blue
```

### `custom:terminal-light-card`

A compact light card with terminal state colors and responsive square controls for brightness, hue, and color temperature when the selected light supports them. The square three-dot button expands or collapses those controls. Its name always remains inside the card; an independent optional `border_title` can additionally label the surrounding room or group.

```yaml
type: custom:terminal-light-card
entity: light.kitchen
name: ceiling light
icon: mdi:ceiling-light
off_icon: mdi:lightbulb-off-outline
border_title: office
show_state: true
show_brightness: true
show_hue: true
show_color_temp: true
use_light_color: true
accent_color: blue
more_icon: mdi:tune-variant
popup_title: light-details
show_controls: true
controls_expanded: false
tap_action:
  action: toggle
hold_action:
  action: more-info
```

All options are available through Home Assistant-native visual form controls. The entity selector only offers `light.*` entities; action fields use Home Assistant's native action editor. The number of square segments adapts automatically to the rendered card width. Temperature runs from warm/low Kelvin on the left to cold/high Kelvin on the right. With `use_light_color`, the active RGB/HS color or color temperature drives the icon, border, controls icon, brightness segments, and popup accent.

### `custom:terminal-switch-card`

A compact card for `switch.*` and `input_boolean.*` entities. Tap toggles the entity by default; hold opens the terminal popup. Both actions can be replaced through Home Assistant's native action editor.

```yaml
type: custom:terminal-switch-card
entity: input_boolean.guest_mode
name: guest mode
icon: mdi:account-check
off_icon: mdi:account-off
border_title: presence
show_state: true
accent_color: green
popup_title: switch-details
tap_action:
  action: toggle
hold_action:
  action: more-info
```

### `custom:terminal-sensor-card`

A read-focused card for `sensor.*` and `binary_sensor.*` entities. It displays Home Assistant's formatted state, accents active binary sensors, and opens the terminal popup on tap by default. Native actions remain configurable for dashboards that need a sensor shortcut.

```yaml
type: custom:terminal-sensor-card
entity: sensor.living_room_temperature
name: living temperature
icon: mdi:thermometer
border_title: living room
show_state: true
accent_color: cyan
tap_action:
  action: more-info
```

### `custom:terminal-calendar-card`

A compact agenda for one `calendar.*` entity. It shows the next three events by default and subscribes to Home Assistant's live calendar event API. The visual editor can change the event count from 1 to 10, search between 1 and 365 days ahead (30 by default), and optionally show event locations. Timed and all-day events are sorted chronologically and rendered as a terminal tree.

```yaml
type: custom:terminal-calendar-card
entity: calendar.family
title: upcoming
max_events: 3
days_to_show: 30
show_location: false
title_position: left
accent_color: cyan
```

### `custom:terminal-shutter-card`

A capability-aware control for `cover.*` entities. The square controls button reveals only the functions supported by the selected shutter or blind: open, stop, close, position, and tilt position.

```yaml
type: custom:terminal-shutter-card
entity: cover.office_blind
name: office blind
icon: mdi:blinds-horizontal
off_icon: mdi:blinds
border_title: office
show_state: true
show_controls: true
show_position: true
show_tilt: true
accent_color: yellow
more_icon: mdi:menu
popup_title: cover-details
controls_expanded: false
hold_action:
  action: more-info
```

### `custom:terminal-navigation-card`

An internal Home Assistant navigation card. `variant` switches between a continuous border and the Wrapper-style name embedded in the top border. The visual editor uses Home Assistant's native navigation-path picker. The optional state `entity` can also power a separate `icon_tap_action`: clicking the main icon runs a native Home Assistant action or service while clicking the remaining card still navigates.

```yaml
type: custom:terminal-navigation-card
name: kitchen
navigation_path: /dashboard-test/kitchen
icon: mdi:lightbulb
off_icon: mdi:lightbulb-off-outline
variant: continuous
border_title: shortcuts # optional for continuous; pane uses name
title_position: right
accent_color: cyan
more_icon: mdi:arrow-right-bold
entity: light.kitchen
state_template: "{{ states(config.entity) | upper }}"
icon_tap_action:
  action: toggle
show_path: true
```

## Appearance and terminal popup

Every card uses Home Assistant's native theme-color palette for `accent_color` (for example `blue`, `green`, `purple`, or `cyan`) instead of an RGB color picker. The selected theme token controls the active border, icons, hover/focus state, and controls, and follows theme overrides such as `--blue-color`. Existing RGB-array configurations remain render-compatible but are no longer offered by the visual editor. The design intentionally has no box-shadow glow. Light state color takes precedence when `use_light_color: true`.

Every card with a border title supports `title_position: left|right`. Wrapper and TitleCard border state support `state_position: top-left|top-right|bottom-left|bottom-right`; labels sharing a corner shrink without overlapping. Light, Switch, Sensor, Shutter, and continuous Navigation Cards support an optional independent `border_title` without moving or replacing the internal entity name. Their domain-aware `off_icon` is used for `off`, and for `closed` covers. Every visible icon receives the same square hover border, including Navigation's trailing icon. Entity icons remain vertically centered against their name/state stack.

A `more-info` action opens the bundle's own terminal-style entity popup instead of Home Assistant's native dialog. On desktop, its borderless terminal-background shell uses the former 14 px top padding equally on all four sides. Its TitleCard-style border title defaults to `more-info` and can be changed with `popup_title`. The card name or entity friendly name is shown separately above the formatted state. On mobile the popup becomes a near-full-width bottom sheet with an 8 px gap on both sides. The layer order is standard `--card-background-color` outer area → 1 px accent border → card surface. The outer area measures 12 vh above and below the popup (or the larger device safe area), protecting rounded phone corners; title/header stay fixed and only the content scrolls. Capability-aware Light and Cover ranges use the same responsive square segments as the cards.

The collapsed `logs` field loads on demand and displays up to six entity changes from Home Assistant's last 24 hours of Logbook data. When expanded, the complete terminal tree is enclosed by its own square Wrapper-style frame with `logs` embedded on the left and the dropdown icon fixed on the right. Service-backed entries place `domain.service · on|off` on their second line. While open, selected-entity changes trigger a debounced live Logbook refresh. The popup also supports pointer and keyboard holds, traps focus, closes with Escape/backdrop/close, and returns focus to the card.

Navigation secondary content uses this precedence: a successful reactive `state_template` result, then free-text `label`, then the formatted `entity` state, then the navigation path when `show_path` is enabled. Wrapper and TitleCard border state use template result, then formatted entity state. Title subtitles combine Markdown with reactive templates. All templates use Home Assistant's `render_template` WebSocket subscription with generation guards and unsubscribe cleanup.

## Installation with HACS

1. Open HACS → **Custom repositories**.
2. Add `https://github.com/agrestisdavid/terminal-cards` as category **Dashboard**.
3. Install **Terminal Cards**.
4. Hard-refresh Home Assistant (`Ctrl+Shift+R`).

HACS loads the release asset `terminal-cards.js`; no inline `data:` resource is needed. All eight cards appear in Home Assistant's card picker and provide graphical configuration.

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
- Home Assistant palette variables selected through `accent_color`, such as `--blue-color`, `--green-color`, and `--purple-color`
- `--error-color`

## License

MIT
