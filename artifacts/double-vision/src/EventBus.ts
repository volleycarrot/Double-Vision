type Listener = () => void;

const progressListeners: Listener[] = [];

export function onProgressChange(fn: Listener): () => void {
  progressListeners.push(fn);
  return () => {
    const idx = progressListeners.indexOf(fn);
    if (idx >= 0) progressListeners.splice(idx, 1);
  };
}

export function emitProgressChange(): void {
  for (const fn of progressListeners) {
    try {
      fn();
    } catch {}
  }
}

export interface SpecialUnlockedDetail {
  id: string;
  name: string;
}

export function dispatchSpecialUnlocked(detail: SpecialUnlockedDetail): void {
  try {
    window.dispatchEvent(new CustomEvent("special-unlocked", { detail }));
  } catch {}
}
