interface RuntimeConfig {
  apiUrl?: string;
  webSocketUrl?: string;
}

// /config.js lo genera el contenedor nginx al arrancar; en `ng serve` no existe.
const runtime = (globalThis as { __UMLINK_CONFIG__?: RuntimeConfig }).__UMLINK_CONFIG__;
const sameOriginWs = (): string =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export const environment = {
  production: false,
  apiUrl: runtime ? runtime.apiUrl || '/api' : 'http://localhost:8080/api',
  webSocketUrl: runtime ? runtime.webSocketUrl || sameOriginWs() : 'ws://localhost:8080/ws',
};
