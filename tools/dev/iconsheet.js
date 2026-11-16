import { ico, ICON_KEYS } from '../../src/ui/icons.js';
document.body.style.cssText = 'background:#0b0f1e;margin:0;padding:12px;font:10px sans-serif;color:#9ab;display:flex;flex-wrap:wrap;gap:8px';
document.body.innerHTML = ICON_KEYS.map(k => `<div style="width:76px;text-align:center">${ico(k, 64)}<div>${k.split(':').slice(1).join(':')}</div></div>`).join('');
