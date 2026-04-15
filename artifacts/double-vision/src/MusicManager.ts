import { isMusicEnabled } from "./GameSettings";

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isPlaying = false;
let currentTimeout: number | null = null;
let isInitialized = false;

const NOTES: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25,
};

const MELODY = [
  "E4", "G4", "A4", "G4", "E4", "D4", "C4", "D4",
  "E4", "E4", "G4", "A4", "B4", "A4", "G4", "E4",
  "C4", "D4", "E4", "D4", "C4", "A3", "C4", "D4",
  "E4", "G4", "E4", "D4", "C4", "D4", "E4", "C4",
];

const BASS = [
  "C3", "C3", "G3", "G3", "A3", "A3", "E3", "E3",
  "F3", "F3", "C3", "C3", "G3", "G3", "C3", "C3",
];

function getOrCreateContext(): AudioContext | null {
  if (audioCtx && audioCtx.state !== "closed") return audioCtx;
  try {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(audioCtx.destination);
    return audioCtx;
  } catch {
    return null;
  }
}

function playNote(ctx: AudioContext, freq: number, startTime: number, duration: number, type: OscillatorType, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function scheduleLoop() {
  if (!isPlaying || !audioCtx || audioCtx.state === "closed") return;
  if (!isMusicEnabled()) {
    isPlaying = false;
    return;
  }

  const ctx = audioCtx;
  const now = ctx.currentTime + 0.1;
  const noteDuration = 0.3;
  const loopLength = MELODY.length * noteDuration;

  for (let i = 0; i < MELODY.length; i++) {
    const note = MELODY[i];
    const freq = NOTES[note];
    if (freq) playNote(ctx, freq, now + i * noteDuration, noteDuration * 0.8, "triangle", 0.3);
  }

  for (let i = 0; i < BASS.length; i++) {
    const note = BASS[i];
    const freq = NOTES[note];
    if (freq) playNote(ctx, freq, now + i * noteDuration * 2, noteDuration * 1.8, "sine", 0.2);
  }

  currentTimeout = window.setTimeout(() => {
    scheduleLoop();
  }, loopLength * 1000 - 200);
}

export function startMusic(): void {
  if (isPlaying) return;
  if (!isMusicEnabled()) return;

  const ctx = getOrCreateContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      isPlaying = true;
      scheduleLoop();
    });
  } else {
    isPlaying = true;
    scheduleLoop();
  }
  isInitialized = true;
}

export function stopMusic(): void {
  isPlaying = false;
  if (currentTimeout !== null) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
  if (audioCtx && audioCtx.state !== "closed") {
    try {
      audioCtx.close();
    } catch {}
    audioCtx = null;
    masterGain = null;
  }
}

export function toggleMusic(enabled: boolean): void {
  if (enabled) {
    startMusic();
  } else {
    stopMusic();
  }
}

let listenersAttached = false;

function onFirstInteraction() {
  document.removeEventListener("click", onFirstInteraction);
  document.removeEventListener("keydown", onFirstInteraction);
  listenersAttached = false;
  if (isMusicEnabled()) {
    startMusic();
  }
  isInitialized = true;
}

export function initMusicOnInteraction(): void {
  if (isInitialized || listenersAttached) return;
  listenersAttached = true;
  document.addEventListener("click", onFirstInteraction);
  document.addEventListener("keydown", onFirstInteraction);
}
