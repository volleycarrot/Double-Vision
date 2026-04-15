import { isMusicEnabled } from "./GameSettings";
import { MusicTrack } from "./tracks/TrackInterface";
import { DefaultTrack } from "./tracks/DefaultTrack";
import { LavaTrack } from "./tracks/LavaTrack";

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isPlaying = false;
let currentTimeout: number | null = null;
let isInitialized = false;
let currentWorldIndex = -1;
let activeTrack: MusicTrack | null = null;
let playbackToken = 0;

const trackCache: Map<number, MusicTrack> = new Map();

function getTrackForWorld(worldIndex: number): MusicTrack {
  const key = worldIndex < 0 ? -1 : worldIndex;
  let track = trackCache.get(key);
  if (track) return track;

  switch (key) {
    case 2:
      track = new LavaTrack();
      break;
    default:
      track = new DefaultTrack();
      break;
  }
  trackCache.set(key, track);
  return track;
}

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

function scheduleLoop() {
  if (!isPlaying || !audioCtx || audioCtx.state === "closed") return;
  if (!isMusicEnabled()) {
    isPlaying = false;
    return;
  }
  if (!activeTrack || !masterGain) return;

  const ctx = audioCtx;
  const now = ctx.currentTime + 0.1;
  const token = playbackToken;

  const sectionDuration = activeTrack.schedule(ctx, masterGain, now);

  if (sectionDuration <= 0) return;

  currentTimeout = window.setTimeout(() => {
    if (playbackToken !== token) return;
    scheduleLoop();
  }, sectionDuration * 1000 - 300);
}

export function startMusic(worldIndex?: number): void {
  const wi = worldIndex ?? currentWorldIndex;

  if (isPlaying && wi === currentWorldIndex) return;
  if (!isMusicEnabled()) {
    currentWorldIndex = wi;
    return;
  }

  if (isPlaying && wi !== currentWorldIndex) {
    stopMusic();
  }

  currentWorldIndex = wi;
  activeTrack = getTrackForWorld(wi);

  const ctx = getOrCreateContext();
  if (!ctx) return;

  const token = ++playbackToken;

  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      if (playbackToken !== token) return;
      isPlaying = true;
      scheduleLoop();
    }).catch(() => {});
  } else {
    isPlaying = true;
    scheduleLoop();
  }
  isInitialized = true;
}

export function stopMusic(): void {
  isPlaying = false;
  playbackToken++;
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

export function setWorldIndex(worldIndex: number): void {
  if (worldIndex === currentWorldIndex) return;
  const wasPlaying = isPlaying;
  if (wasPlaying) {
    stopMusic();
  }
  currentWorldIndex = worldIndex;
  activeTrack = getTrackForWorld(worldIndex);
  if (wasPlaying) {
    startMusic(worldIndex);
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
