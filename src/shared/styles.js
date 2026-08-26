export const TERMINAL_FONT = `ui-monospace, "Cascadia Code", "JetBrains Mono",
  "Fira Code", Consolas, "Liberation Mono", monospace`;

export const TERMINAL_COLORS = `
  --terminal-background: var(--ha-card-background, var(--card-background-color, #181825));
  --terminal-text: var(--primary-text-color, #cdd6f4);
  --terminal-dim: var(--secondary-text-color, #6c7086);
  --terminal-accent: var(--accent-color, #89b4fa);
  --terminal-error: var(--error-color, #f38ba8);
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
