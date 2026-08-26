export const DOCUMENTATION_URL =
  'https://github.com/agrestisdavid/terminal-cards#readme';

export function defineElement(name, constructor) {
  if (!customElements.get(name)) {
    customElements.define(name, constructor);
  }
}

export function registerCard(card) {
  window.customCards = window.customCards || [];
  if (!window.customCards.some((entry) => entry.type === card.type)) {
    window.customCards.push(card);
  }
}

export function fireConfigChanged(element, config) {
  element.dispatchEvent(
    new CustomEvent('config-changed', {
      bubbles: true,
      composed: true,
      detail: { config },
    })
  );
}

export function fireMoreInfo(element, entityId) {
  element.dispatchEvent(
    new CustomEvent('hass-more-info', {
      bubbles: true,
      composed: true,
      detail: { entityId },
    })
  );
}

export function executeAction(element, hass, config, actionConfig) {
  const action = actionConfig?.action || 'none';
  const entityId = config.entity;

  if (action === 'none') return;
  if (action === 'toggle') {
    hass.callService('light', 'toggle', {}, { entity_id: entityId });
    return;
  }
  if (action === 'more-info') {
    fireMoreInfo(element, entityId);
    return;
  }
  if (action === 'navigate' && actionConfig.navigation_path) {
    history.pushState(null, '', actionConfig.navigation_path);
    window.dispatchEvent(new CustomEvent('location-changed'));
    return;
  }
  if (action === 'url' && actionConfig.url_path) {
    try {
      const url = new URL(actionConfig.url_path, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return;
      if (actionConfig.new_tab === false) {
        window.location.assign(url.href);
      } else {
        window.open(url.href, '_blank', 'noopener,noreferrer');
      }
    } catch (_error) {
      // Ignore malformed or unsupported URLs from imported dashboard config.
    }
    return;
  }
  if (action === 'perform-action' || action === 'call-service') {
    const service = actionConfig.perform_action || actionConfig.service;
    if (!service?.includes('.')) return;
    const [domain, serviceName] = service.split('.', 2);
    hass.callService(
      domain,
      serviceName,
      actionConfig.data || actionConfig.service_data || {},
      actionConfig.target || { entity_id: entityId }
    );
  }
}
