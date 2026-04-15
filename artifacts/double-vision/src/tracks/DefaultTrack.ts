import { MusicTrack, playNote } from "./TrackInterface";

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

export class DefaultTrack implements MusicTrack {
  schedule(ctx: AudioContext, masterGain: GainNode, startTime: number): number {
    const noteDuration = 0.3;

    for (let i = 0; i < MELODY.length; i++) {
      const freq = NOTES[MELODY[i]];
      if (freq) playNote(ctx, masterGain, freq, startTime + i * noteDuration, noteDuration * 0.8, "triangle", 0.3);
    }

    for (let i = 0; i < BASS.length; i++) {
      const freq = NOTES[BASS[i]];
      if (freq) playNote(ctx, masterGain, freq, startTime + i * noteDuration * 2, noteDuration * 1.8, "sine", 0.2);
    }

    return MELODY.length * noteDuration;
  }
}
