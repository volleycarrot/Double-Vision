export interface MusicTrack {
  schedule(ctx: AudioContext, masterGain: GainNode, startTime: number): number;
}

export function noteFreq(name: string, octave: number): number {
  const semitones: Record<string, number> = {
    "C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6,
    "E": -5, "F": -4, "F#": -3, "Gb": -3, "G": -2, "G#": -1, "Ab": -1,
    "A": 0, "A#": 1, "Bb": 1, "B": 2,
  };
  const s = semitones[name];
  if (s === undefined) return 440;
  return 440 * Math.pow(2, (octave - 4) + s / 12);
}

export function playNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  fadeRatio = 0.9,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * fadeRatio);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playNotePitchBend(
  ctx: AudioContext,
  dest: AudioNode,
  freqStart: number,
  freqEnd: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startTime);
  osc.frequency.linearRampToValueAtTime(freqEnd, startTime + duration * 0.8);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
}
