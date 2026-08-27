# Changelog

## 0.7.0 — 2026-08-27

- Replace every Terminal Card RGB color picker with Home Assistant's native internal theme-color palette.
- Resolve selected names such as `blue`, `green`, `purple`, and `cyan` through Home Assistant theme variables so theme overrides stay reactive.
- Keep existing RGB-array configurations render-compatible while no longer offering RGB values in visual editors.

## 0.6.0 — 2026-08-27

- Match the mobile popup's bottom outer spacing to its 12 vh top spacing while preserving the 8 px side gaps and safe-area fallback.
- Keep the expanded Logbook dropdown icon aligned at the far right of its frame.
- Render service-backed Logbook events with `domain.service · on|off` on the second tree line instead of duplicating the state on the first line.
- Refresh an open Logbook automatically after the selected entity changes, with a 500 ms debounce and existing stale-connection guards.

## 0.5.2 — 2026-08-27

- Add an 8 px mobile gap between the popup accent border and both screen edges.
- Use the standard `--card-background-color` for the outer top, side, and bottom areas instead of white.

## 0.5.1 — 2026-08-27

- Make the mobile popup layering explicit: white outer area, accent border, then card surface.
- Remove the dark shell gap above the accent border and reserve exactly 5 vh of white bottom clearance, with safe-area fallback.

## 0.5.0 — 2026-08-27

- Rework the mobile entity popup into a full-width bottom sheet below a dynamic 12 vh top gap, with safe-area-aware bottom corner clearance.
- Use `more-info` as the default TitleCard-style popup border title while keeping `popup_title` available as a visual-editor override.
- Restore the card/entity name above the formatted popup state.
- Enclose expanded Logbook entries in their own square terminal frame with `logs` embedded in the border.
- Make TitleCard more compact and lower its title slightly into the border.
- Add a reactive `subtitle` field to TitleCard that supports Markdown and Home Assistant templates.
- Add Wrapper `entity`, `state_template`, and four-corner `state_position` options with collision-safe border labels.
- Preserve focused popup controls across entity refreshes and guard Logbook retry/reconnect results against stale WebSocket connections.

## 0.4.0 — 2026-08-27

- Add `custom:terminal-title-card`: a title-only terminal frame with native accent, title-position, and 14-48 px font-size controls.
- Stretch a single final Wrapper child across the complete grid row.
- Use the configurable entity name as the popup's larger TitleCard-style border title.
- Add `popup_title` to Light and Shutter Cards with fallback to card name and entity friendly name.
- Turn the mobile popup into an 8 px near-fullscreen layout with a fixed title/header and independently scrolling body.
- Add an on-demand `logs` field that renders up to six recent entity Logbook changes as a terminal tree with timestamps and context.

## 0.3.2 — 2026-08-27

- Place the bordered terminal popup inside its own borderless background shell and keep the border title stacked above the dialog.

## 0.3.1 — 2026-08-27

- Keep the terminal popup border title fully visible above its scrollable dialog.
- Replace popup-native sliders with the same responsive segmented Light/Cover controls used by the cards.
- Remove box-shadow glow from every card, wrapper, and popup while preserving accent borders and focus states.
- Accent the Navigation Card name on hover/focus like the other interactive cards.
- Correct Light and popup temperature direction to warm/low Kelvin on the left and cold/high Kelvin on the right.
- Let Navigation Cards show a formatted entity state or a reactive Home Assistant Jinja template result.
- Add template subscription generation guards, unsubscribe cleanup, reconnect coverage, and native entity/template editor fields.

## 0.3.0 — 2026-08-27

- Keep Navigation Card content pinned to the top when adjacent cards expand.
- Stretch capability-aware shutter command buttons across the full available width.
- Apply active light color to the controls icon and brightness segments.
- Color the Wrapper border title together with its hover/focus glow.
- Add native per-card RGB accent selection to Wrapper, Light, Shutter, and Navigation Cards.
- Add left/right border-title placement to Wrapper and pane-style Navigation Cards.
- Add configurable controls/navigation icons to Light, Shutter, and Navigation Cards.
- Replace native More Info actions with an accessible terminal-style entity popup containing status and capability-aware Light/Cover controls.
- Add pointer/keyboard hold, Escape/backdrop close, focus restoration, and popup lifecycle cleanup.

## 0.2.0 — 2026-08-27

- Add `custom:terminal-shutter-card` for capability-aware cover control: open, stop, close, position, and tilt.
- Add `custom:terminal-navigation-card` with continuous-border and title-in-border variants plus the native HA navigation-path selector.
- Add optional active RGB/HS/color-temperature feedback on the Light Card icon and border.
- Add the same accent glow to Wrapper hover/focus that interactive Terminal Cards use.
- Register and test all four cards in the shared HACS bundle.

## 0.1.2 — 2026-08-27

- Make the square controls button expand and collapse the Light Card controls instead of opening more-info.
- Align control values directly below the controls button.
- Calculate brightness segments from the available track width so narrow cards never overlap.
- Add capability-aware hue and color-temperature controls.
- Stretch Wrapper children to equal heights within each grid row.
- Rebuild the Wrapper editor with native `ha-form`, tabs, icon buttons, card picker, and child-card editor components.
- Group Light Card settings in Home Assistant-native expandable form sections.
- Add `show_controls`; legacy `show_more_info` configurations remain compatible.

## 0.1.1 — 2026-08-26

- Replace the native brightness line with 16 interactive square segments.
- Show `0%` brightness whenever a light is off; moving the dimmer to zero turns it off.
- Render localized state labels in lowercase.
- Highlight the complete Light Card on hover.
- Center the more-info icon inside its circular hover target.

## 0.1.0 — 2026-08-26

- Add `custom:terminal-card-wrapper` for arbitrary Lovelace child cards.
- Add `custom:terminal-light-card` with on/off/unavailable colors and brightness control.
- Add graphical configuration for both cards.
- Add native child-card picker/editor integration to the wrapper.
- Add HACS metadata, release workflow, and headless browser regression tests.
