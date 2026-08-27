# Changelog

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
