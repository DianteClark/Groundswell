// Mobile / iOS helpers: viewport height var, zoom & callout guards, standalone detection.
let installed = false;

export const isIOS = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () => typeof window !== 'undefined' && (navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
export const isTouch = () => typeof window !== 'undefined' && ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0);

function setVh() {
  const h = window.visualViewport?.height || window.innerHeight;
  const w = window.visualViewport?.width || window.innerWidth;
  const r = document.documentElement.style;
  r.setProperty('--app-h', Math.round(h) + 'px');
  r.setProperty('--app-w', Math.round(w) + 'px');
  document.documentElement.classList.toggle('landscape', w > h);
  document.documentElement.classList.toggle('short', h < 460);
  document.documentElement.classList.toggle('cl', w > h && h <= 520);
}

export function installMobileGuards() {
  if (installed || typeof window === 'undefined') return; installed = true;
  const de = document.documentElement;
  de.classList.toggle('touch', isTouch());
  de.classList.toggle('ios', isIOS());
  de.classList.toggle('standalone', isStandalone());
  setVh();
  window.addEventListener('resize', setVh);
  window.addEventListener('orientationchange', () => setTimeout(setVh, 250));
  window.visualViewport?.addEventListener('resize', setVh);
  // iOS: block pinch-zoom & double-tap zoom (touch-action covers most; Safari still needs these)
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 320 && !(e.target.closest && e.target.closest('input,textarea,select'))) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (!(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); });
}

/** Block page scrolling/rubber-banding while a match is on screen. */
export function setMatchMode(on) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('in-match', !!on);
}
