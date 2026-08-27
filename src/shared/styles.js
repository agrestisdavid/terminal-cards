export const TERMINAL_FONT = `ui-monospace, "Cascadia Code", "JetBrains Mono",
  "Fira Code", Consolas, "Liberation Mono", monospace`;

export const TERMINAL_COLORS = `
  --terminal-background: var(--ha-card-background, var(--card-background-color, #181825));
  --terminal-text: var(--primary-text-color, #cdd6f4);
  --terminal-dim: var(--secondary-text-color, #6c7086);
  --terminal-accent: var(--terminal-card-accent, var(--accent-color, #89b4fa));
  --terminal-error: var(--error-color, #f38ba8);
`;

export const TERMINAL_ENTITY_ALIGNMENT = `
  .icon {
    align-self: center;
    display: grid;
    place-items: center;
    line-height: 0;
    --mdc-icon-size: 28px;
  }
  .text {
    align-self: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 30px;
  }
`;

export const TERMINAL_MAIN_ICON_HOVER = `
  .icon {
    box-sizing: border-box;
    width: 34px;
    height: 34px;
    border: 1px solid transparent;
    pointer-events: auto;
  }
  .icon:hover {
    border-color: currentColor;
  }
`;

export const TERMINAL_BORDER_TITLE = `
  .border-title {
    position: absolute;
    z-index: 1;
    top: 0;
    left: 12px;
    box-sizing: border-box;
    transform: translateY(-50%);
    max-width: calc(100% - 24px);
    padding: 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--terminal-background);
    color: var(--terminal-dim);
    font: 12px/1.4 ${TERMINAL_FONT};
    pointer-events: none;
  }
  .border-title[data-title-position="right"] {
    right: 12px;
    left: auto;
  }
  .border-title[hidden] { display: none; }
  .card:hover .border-title,
  .card:focus-within .border-title {
    color: var(--terminal-effective-accent, var(--terminal-accent));
  }
`;

export const EDITOR_STYLES = `
  :host { display: block; }
  .editor { display: grid; gap: 16px; }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .field { display: grid; gap: 6px; }
  label { color: var(--primary-text-color); font-size: 14px; }
  input, select, textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 40px;
    padding: 8px 10px;
    border: 1px solid var(--divider-color, #6c7086);
    border-radius: var(--ha-card-border-radius, 4px);
    background: var(--input-fill-color, transparent);
    color: var(--primary-text-color);
    font: inherit;
  }
  input[type="checkbox"] { width: auto; min-height: auto; }
  button {
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid var(--divider-color, #6c7086);
    border-radius: var(--ha-card-border-radius, 4px);
    background: var(--secondary-background-color, transparent);
    color: var(--primary-text-color);
    cursor: pointer;
  }
  .checkbox { display: flex; align-items: center; gap: 8px; }
  .hint { color: var(--secondary-text-color); font-size: 12px; }
`;
