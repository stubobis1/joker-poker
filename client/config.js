const _stored = localStorage.getItem('serverUrl');
const _wsBase  = _stored || 'ws://localhost:3777';
export const SERVER_WS   = _wsBase;
export const SERVER_HTTP = _wsBase.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
