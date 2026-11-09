// On iOS the on-screen keyboard overlays the page without resizing it. This
// publishes how much of the bottom is covered (`--keyboard-inset`) and how much
// is visible (`--visible-height`) on <html>, so bottom sheets can sit above it.

export function computeKeyboardInset(innerHeight, visualViewport) {
  return Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop);
}

export function startKeyboardInset(win = window, root = document.documentElement) {
  const vv = win.visualViewport;
  if (!vv) return null;
  const update = () => {
    root.style.setProperty('--keyboard-inset', `${computeKeyboardInset(win.innerHeight, vv)}px`);
    root.style.setProperty('--visible-height', `${vv.height}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
  return update;
}
