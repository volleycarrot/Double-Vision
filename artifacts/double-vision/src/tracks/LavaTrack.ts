import { MusicTrack, noteFreq, playNote, playNotePitchBend } from "./TrackInterface";

function n(name: string, oct: number): number {
  return noteFreq(name, oct);
}

interface Section {
  bpm: number;
  duration: number;
  play: (ctx: AudioContext, dest: AudioNode, t: number, bpm: number) => void;
}

function beat(bpm: number): number {
  return 60 / bpm;
}

function drone(ctx: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(vol, start + dur * 0.15);
  gain.gain.setValueAtTime(vol, start + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + dur);
}

function percHit(ctx: AudioContext, dest: AudioNode, start: number, vol: number, pitch: number = 100) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(pitch, start);
  osc.frequency.exponentialRampToValueAtTime(30, start + 0.08);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.12);
}

function hiHat(ctx: AudioContext, dest: AudioNode, start: number, vol: number) {
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "highpass";
  bandpass.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);
  src.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(dest);
  src.start(start);
  src.stop(start + 0.06);
}

const sections: Section[] = [

  {
    bpm: 76,
    duration: 96,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      drone(ctx, dest, n("D", 2), t, 48 * b, 0.12, "sine");
      drone(ctx, dest, n("A", 2), t + 8 * b, 36 * b, 0.08, "sine");
      drone(ctx, dest, n("D", 2), t + 44 * b, 52 * b, 0.14, "sine");
      drone(ctx, dest, n("F", 2), t + 48 * b, 48 * b, 0.07, "triangle");
      drone(ctx, dest, n("A", 1), t + 60 * b, 36 * b, 0.06, "sine");

      const melody: [number, number, number][] = [
        [n("D", 4), 16, 0.06], [n("F", 4), 20, 0.08], [n("A", 4), 24, 0.10],
        [n("E", 4), 28, 0.09], [n("D", 4), 32, 0.11], [n("C", 4), 36, 0.10],
        [n("D", 4), 40, 0.12], [n("F", 4), 44, 0.14], [n("G", 4), 48, 0.15],
        [n("A", 4), 50, 0.16], [n("F", 4), 54, 0.14], [n("E", 4), 56, 0.12],
        [n("D", 4), 58, 0.10], [n("C", 4), 62, 0.11], [n("D", 4), 66, 0.13],
        [n("F", 4), 70, 0.15], [n("A", 4), 74, 0.16], [n("G", 4), 78, 0.14],
        [n("F", 4), 82, 0.12], [n("E", 4), 86, 0.10], [n("D", 4), 90, 0.08],
      ];
      for (const [freq, beatOff, vol] of melody) {
        playNote(ctx, dest, freq, t + beatOff * b, b * 3, "triangle", vol);
      }

      for (let i = 24; i < 96; i += 4) {
        percHit(ctx, dest, t + i * b, 0.03 + (i - 24) * 0.0008, 60);
      }

      const lowPad = [n("D", 3), n("F", 3), n("A", 3)];
      for (let bar = 6; bar < 12; bar++) {
        for (const pf of lowPad) {
          playNote(ctx, dest, pf, t + bar * 8 * b, b * 7, "sine", 0.03);
        }
      }
    },
  },

  {
    bpm: 138,
    duration: 138,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      const melodyA = [
        n("E", 4), n("G", 4), n("B", 4), n("A", 4), n("G", 4), n("F#", 4), n("E", 4), n("D", 4),
        n("E", 4), n("A", 4), n("B", 4), n("G", 4), n("F#", 4), n("E", 4), n("D", 4), n("E", 4),
      ];
      const melodyB = [
        n("B", 4), n("A", 4), n("G", 4), n("E", 4), n("F#", 4), n("A", 4), n("B", 4), n("E", 5),
        n("D", 5), n("B", 4), n("A", 4), n("G", 4), n("F#", 4), n("E", 4), n("G", 4), n("A", 4),
      ];
      const melodyC = [
        n("E", 5), n("D", 5), n("B", 4), n("G", 4), n("A", 4), n("B", 4), n("D", 5), n("E", 5),
        n("F#", 5), n("E", 5), n("D", 5), n("B", 4), n("A", 4), n("G", 4), n("A", 4), n("B", 4),
      ];
      for (let rep = 0; rep < 2; rep++) {
        const off = rep * 48;
        for (let i = 0; i < melodyA.length; i++) {
          playNote(ctx, dest, melodyA[i], t + (off + i) * b, b * 0.7, "sawtooth", 0.13 + rep * 0.02);
        }
        for (let i = 0; i < melodyB.length; i++) {
          playNote(ctx, dest, melodyB[i], t + (off + 16 + i) * b, b * 0.7, "sawtooth", 0.14 + rep * 0.02);
        }
        for (let i = 0; i < melodyC.length; i++) {
          playNote(ctx, dest, melodyC[i], t + (off + 32 + i) * b, b * 0.7, "sawtooth", 0.15 + rep * 0.01);
        }
      }
      const counterNotes = [
        n("B", 4), n("E", 5), n("D", 5), n("B", 4), n("A", 4), n("G", 4), n("A", 4), n("B", 4),
        n("E", 5), n("D", 5), n("B", 4), n("A", 4), n("G", 4), n("F#", 4), n("G", 4), n("A", 4),
      ];
      for (let rep = 0; rep < 2; rep++) {
        for (let i = 0; i < counterNotes.length; i++) {
          playNote(ctx, dest, counterNotes[i], t + (48 + rep * 32 + i * 2) * b, b * 1.5, "triangle", 0.07 + rep * 0.01);
        }
      }
      const bassNotes = [n("E", 2), n("E", 2), n("A", 2), n("A", 2), n("G", 2), n("G", 2), n("B", 2), n("E", 2)];
      for (let rep = 0; rep < 8; rep++) {
        for (let i = 0; i < bassNotes.length; i++) {
          const bt = t + (rep * bassNotes.length * 2 + i * 2) * b;
          playNote(ctx, dest, bassNotes[i], bt, b * 1.8, "square", 0.10);
        }
      }
      for (let i = 0; i < 138; i++) {
        percHit(ctx, dest, t + i * b, i % 2 === 0 ? 0.08 : 0.04, i % 4 === 0 ? 80 : 60);
        if (i % 2 === 1) hiHat(ctx, dest, t + (i + 0.5) * b, 0.05);
      }
      for (let i = 128; i < 138; i++) {
        playNotePitchBend(ctx, dest, n("E", 5), n("E", 4), t + i * b, b * 0.9, "sawtooth", 0.06);
      }
    },
  },

  {
    bpm: 118,
    duration: 120,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      const pulsePattern = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0];
      const pulseNotes = [n("C", 4), n("Eb", 4), n("G", 4), n("Bb", 4)];
      for (let bar = 0; bar < 14; bar++) {
        for (let i = 0; i < pulsePattern.length; i++) {
          if (pulsePattern[i]) {
            const noteIdx = (bar + Math.floor(i / 4)) % pulseNotes.length;
            playNote(ctx, dest, pulseNotes[noteIdx], t + (bar * 16 + i) * b * 0.5, b * 0.4, "square", 0.09);
          }
        }
      }
      const melodyLine = [
        n("C", 5), n("Bb", 4), n("G", 4), n("Eb", 4), n("F", 4), n("G", 4), n("Bb", 4), n("C", 5),
        n("D", 5), n("C", 5), n("Bb", 4), n("Ab", 4), n("G", 4), n("F", 4), n("Eb", 4), n("D", 4),
      ];
      const melodyLine2 = [
        n("Eb", 4), n("G", 4), n("Bb", 4), n("C", 5), n("D", 5), n("Eb", 5), n("D", 5), n("C", 5),
        n("Bb", 4), n("Ab", 4), n("G", 4), n("F", 4), n("Eb", 4), n("G", 4), n("Bb", 4), n("C", 5),
      ];
      for (let i = 0; i < melodyLine.length; i++) {
        playNote(ctx, dest, melodyLine[i], t + (8 + i * 2) * b, b * 1.6, "sawtooth", 0.11);
      }
      for (let i = 0; i < melodyLine2.length; i++) {
        playNote(ctx, dest, melodyLine2[i], t + (48 + i * 2) * b, b * 1.6, "sawtooth", 0.12);
      }
      for (let i = 0; i < melodyLine.length; i++) {
        playNote(ctx, dest, melodyLine[i] * 1.005, t + (80 + i * 2) * b, b * 1.8, "triangle", 0.10);
      }
      const bassLine = [n("C", 2), n("Eb", 2), n("G", 2), n("Bb", 2), n("Ab", 2), n("F", 2), n("G", 2), n("C", 2)];
      for (let rep = 0; rep < 7; rep++) {
        for (let i = 0; i < bassLine.length; i++) {
          playNote(ctx, dest, bassLine[i], t + (rep * 16 + i * 2) * b, b * 1.8, "sine", 0.13);
        }
      }
      drone(ctx, dest, n("C", 3), t, 60 * b, 0.06, "triangle");
      drone(ctx, dest, n("G", 2), t + 60 * b, 60 * b, 0.06, "triangle");
      for (let i = 0; i < 120; i += 2) {
        percHit(ctx, dest, t + i * b, 0.06, 70);
        if (i % 8 === 4) hiHat(ctx, dest, t + i * b, 0.04);
      }
    },
  },

  {
    bpm: 88,
    duration: 96,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      drone(ctx, dest, n("F#", 2), t, 96 * b, 0.12, "sine");
      drone(ctx, dest, n("C#", 3), t + 8 * b, 80 * b, 0.07, "sine");
      drone(ctx, dest, n("A", 2), t + 48 * b, 48 * b, 0.05, "triangle");
      const arpNotes = [n("F#", 4), n("A", 4), n("C#", 5), n("E", 5), n("C#", 5), n("A", 4)];
      for (let bar = 0; bar < 16; bar++) {
        for (let i = 0; i < arpNotes.length; i++) {
          const vol = 0.07 + Math.sin(bar * 0.4) * 0.03;
          playNote(ctx, dest, arpNotes[i], t + (bar * arpNotes.length + i) * b, b * 0.8, "triangle", vol);
        }
      }
      const counterArp = [n("A", 5), n("F#", 5), n("E", 5), n("C#", 5)];
      const counterArp2 = [n("E", 5), n("C#", 5), n("A", 4), n("F#", 4)];
      for (let bar = 3; bar < 10; bar++) {
        for (let i = 0; i < counterArp.length; i++) {
          playNote(ctx, dest, counterArp[i], t + (bar * 6 + i * 1.5 + 3) * b, b * 1.2, "sine", 0.05);
        }
      }
      for (let bar = 10; bar < 16; bar++) {
        for (let i = 0; i < counterArp2.length; i++) {
          playNote(ctx, dest, counterArp2[i], t + (bar * 6 + i * 1.5 + 3) * b, b * 1.2, "sine", 0.05);
        }
      }
      const bassWalk = [n("F#", 2), n("E", 2), n("D", 2), n("C#", 2), n("D", 2), n("E", 2), n("F#", 2), n("A", 2)];
      for (let rep = 0; rep < 5; rep++) {
        for (let i = 0; i < bassWalk.length; i++) {
          playNote(ctx, dest, bassWalk[i], t + (16 + rep * 16 + i * 2) * b, b * 1.8, "sine", 0.10);
        }
      }
      for (let i = 16; i < 96; i += 4) {
        percHit(ctx, dest, t + i * b, 0.03, 50);
      }
    },
  },

  {
    bpm: 148,
    duration: 148,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      const leadA = [
        n("A", 4), n("C", 5), n("E", 5), n("A", 5), n("G", 5), n("E", 5), n("C", 5), n("D", 5),
        n("E", 5), n("G", 5), n("A", 5), n("E", 5), n("D", 5), n("C", 5), n("A", 4), n("G", 4),
      ];
      const leadB = [
        n("A", 4), n("B", 4), n("C", 5), n("E", 5), n("G", 5), n("E", 5), n("D", 5), n("C", 5),
        n("B", 4), n("A", 4), n("G", 4), n("A", 4), n("C", 5), n("D", 5), n("E", 5), n("A", 5),
      ];
      const leadC = [
        n("A", 5), n("G", 5), n("E", 5), n("D", 5), n("C", 5), n("E", 5), n("G", 5), n("A", 5),
        n("B", 5), n("A", 5), n("G", 5), n("E", 5), n("D", 5), n("C", 5), n("D", 5), n("E", 5),
      ];
      for (let rep = 0; rep < 3; rep++) {
        const off = rep * 48;
        const mel = rep === 0 ? leadA : rep === 1 ? leadB : leadC;
        for (let i = 0; i < mel.length; i++) {
          playNote(ctx, dest, mel[i], t + (off + i) * b, b * 0.6, "sawtooth", 0.14 + rep * 0.01);
        }
      }
      const riffNotes = [n("A", 3), n("C", 4), n("E", 4), n("A", 3), n("G", 3), n("E", 3), n("G", 3), n("A", 3)];
      for (let rep = 0; rep < 12; rep++) {
        for (let i = 0; i < riffNotes.length; i++) {
          playNote(ctx, dest, riffNotes[i], t + (rep * 12 + i) * b, b * 0.8, "square", 0.07 + (rep % 3) * 0.01);
        }
      }
      const bassNotes = [n("A", 2), n("A", 2), n("C", 3), n("C", 3), n("G", 2), n("G", 2), n("E", 2), n("A", 2)];
      for (let rep = 0; rep < 9; rep++) {
        for (let i = 0; i < bassNotes.length; i++) {
          playNote(ctx, dest, bassNotes[i], t + (rep * 16 + i * 2) * b, b * 1.8, "sawtooth", 0.11);
        }
      }
      for (let i = 0; i < 148; i++) {
        if (i % 2 === 0) percHit(ctx, dest, t + i * b, 0.09, 90);
        if (i % 4 === 2) hiHat(ctx, dest, t + i * b, 0.06);
        if (i % 8 === 0) percHit(ctx, dest, t + i * b, 0.07, 40);
      }
      for (let i = 140; i < 148; i++) {
        playNotePitchBend(ctx, dest, n("A", 4), n("A", 3), t + i * b, b * 0.9, "sawtooth", 0.06);
      }
    },
  },

  {
    bpm: 98,
    duration: 100,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      drone(ctx, dest, n("Bb", 2), t, 50 * b, 0.10, "sine");
      drone(ctx, dest, n("F", 3), t, 50 * b, 0.06, "triangle");
      drone(ctx, dest, n("Bb", 2), t + 50 * b, 50 * b, 0.10, "sine");
      drone(ctx, dest, n("Db", 3), t + 50 * b, 50 * b, 0.06, "triangle");
      const chordTones: number[][] = [
        [n("Bb", 3), n("Db", 4), n("F", 4)],
        [n("Gb", 3), n("Bb", 3), n("Db", 4)],
        [n("Ab", 3), n("C", 4), n("Eb", 4)],
        [n("Bb", 3), n("Db", 4), n("F", 4)],
        [n("Db", 4), n("F", 4), n("Ab", 4)],
        [n("Eb", 4), n("Gb", 4), n("Bb", 4)],
      ];
      for (let c = 0; c < 12; c++) {
        const chord = chordTones[c % chordTones.length];
        for (const freq of chord) {
          playNote(ctx, dest, freq, t + c * 8 * b, b * 7, "triangle", 0.06);
        }
      }
      const epicMelody = [
        n("F", 5), n("Db", 5), n("Bb", 4), n("F", 4), n("Gb", 4), n("Ab", 4), n("Bb", 4), n("Db", 5),
        n("Eb", 5), n("F", 5), n("Eb", 5), n("Db", 5), n("C", 5), n("Bb", 4), n("Ab", 4), n("Bb", 4),
      ];
      const epicMelody2 = [
        n("Db", 5), n("F", 5), n("Gb", 5), n("F", 5), n("Eb", 5), n("Db", 5), n("C", 5), n("Db", 5),
        n("Eb", 5), n("F", 5), n("Ab", 5), n("Gb", 5), n("F", 5), n("Eb", 5), n("Db", 5), n("C", 5),
      ];
      for (let i = 0; i < epicMelody.length; i++) {
        playNote(ctx, dest, epicMelody[i], t + (8 + i * 2) * b, b * 1.8, "sawtooth", 0.13);
      }
      for (let i = 0; i < epicMelody2.length; i++) {
        playNote(ctx, dest, epicMelody2[i], t + (48 + i * 2) * b, b * 1.8, "sawtooth", 0.14);
      }
      for (let i = 0; i < epicMelody.length; i++) {
        playNote(ctx, dest, epicMelody[i] * 0.5, t + (80 + i) * b, b * 1.5, "triangle", 0.08);
      }
      for (let i = 0; i < 100; i += 2) {
        percHit(ctx, dest, t + i * b, 0.05, 65);
      }
    },
  },

  {
    bpm: 156,
    duration: 140,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      const leadA = [
        n("G", 5), n("F", 5), n("D", 5), n("Bb", 4), n("C", 5), n("D", 5), n("F", 5), n("G", 5),
        n("A", 5), n("G", 5), n("F", 5), n("D", 5), n("C", 5), n("Bb", 4), n("A", 4), n("G", 4),
      ];
      const leadB = [
        n("Bb", 4), n("D", 5), n("F", 5), n("G", 5), n("A", 5), n("Bb", 5), n("A", 5), n("G", 5),
        n("F", 5), n("D", 5), n("C", 5), n("D", 5), n("F", 5), n("G", 5), n("Bb", 5), n("A", 5),
      ];
      const leadC = [
        n("G", 5), n("Bb", 5), n("A", 5), n("F", 5), n("D", 5), n("C", 5), n("D", 5), n("F", 5),
        n("G", 5), n("A", 5), n("Bb", 5), n("G", 5), n("F", 5), n("D", 5), n("C", 5), n("Bb", 4),
      ];
      for (let rep = 0; rep < 2; rep++) {
        const off = rep * 48;
        for (let i = 0; i < leadA.length; i++) {
          playNote(ctx, dest, leadA[i], t + (off + i) * b, b * 0.5, "square", 0.12 + rep * 0.02);
        }
        for (let i = 0; i < leadB.length; i++) {
          playNote(ctx, dest, leadB[i], t + (off + 16 + i) * b, b * 0.5, "square", 0.13 + rep * 0.01);
        }
        for (let i = 0; i < leadC.length; i++) {
          playNote(ctx, dest, leadC[i], t + (off + 32 + i) * b, b * 0.5, "sawtooth", 0.12 + rep * 0.02);
        }
      }
      const bass = [n("G", 2), n("Bb", 2), n("C", 3), n("D", 3), n("C", 3), n("Bb", 2), n("A", 2), n("G", 2)];
      for (let rep = 0; rep < 16; rep++) {
        for (let i = 0; i < bass.length; i++) {
          playNote(ctx, dest, bass[i], t + (rep * 8 + i) * b, b * 0.8, "sawtooth", 0.11);
        }
      }
      for (let i = 0; i < 140; i++) {
        percHit(ctx, dest, t + i * b, i % 2 === 0 ? 0.10 : 0.05, i % 4 === 0 ? 100 : 70);
        hiHat(ctx, dest, t + (i + 0.5) * b, 0.05);
      }
      const gliss = [n("G", 4), n("A", 4), n("Bb", 4), n("C", 5), n("D", 5), n("F", 5), n("G", 5), n("A", 5), n("Bb", 5), n("C", 6)];
      for (let i = 0; i < gliss.length; i++) {
        playNote(ctx, dest, gliss[i], t + (128 + i) * b, b * 0.9, "triangle", 0.08);
      }
    },
  },

  {
    bpm: 82,
    duration: 96,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      drone(ctx, dest, n("D", 2), t, 96 * b, 0.10, "sine");
      drone(ctx, dest, n("A", 2), t + 8 * b, 72 * b, 0.06, "sine");
      drone(ctx, dest, n("F", 3), t + 48 * b, 48 * b, 0.04, "triangle");
      const reflMelodyA = [
        n("D", 5), n("F", 5), n("A", 5), n("G", 5), n("F", 5), n("E", 5), n("D", 5), n("C", 5),
        n("D", 5), n("E", 5), n("F", 5), n("A", 5), n("G", 5), n("F", 5), n("E", 5), n("D", 5),
      ];
      const reflMelodyB = [
        n("A", 4), n("C", 5), n("D", 5), n("F", 5), n("E", 5), n("D", 5), n("C", 5), n("A", 4),
        n("G", 4), n("A", 4), n("C", 5), n("D", 5), n("E", 5), n("F", 5), n("D", 5), n("C", 5),
      ];
      const reflMelodyC = [
        n("F", 5), n("E", 5), n("D", 5), n("C", 5), n("A", 4), n("G", 4), n("A", 4), n("C", 5),
        n("D", 5), n("F", 5), n("E", 5), n("D", 5), n("A", 4), n("G", 4), n("F", 4), n("D", 4),
      ];
      for (let i = 0; i < reflMelodyA.length; i++) {
        playNote(ctx, dest, reflMelodyA[i], t + (4 + i * 2) * b, b * 2.5, "triangle", 0.11);
      }
      for (let i = 0; i < reflMelodyB.length; i++) {
        playNote(ctx, dest, reflMelodyB[i], t + (36 + i * 2) * b, b * 2.5, "triangle", 0.10);
      }
      for (let i = 0; i < reflMelodyC.length; i++) {
        playNote(ctx, dest, reflMelodyC[i], t + (68 + i * 2) * b, b * 2.5, "sine", 0.09);
      }
      const padNotes = [n("D", 3), n("F", 3), n("A", 3)];
      for (let bar = 0; bar < 12; bar++) {
        for (const pn of padNotes) {
          playNote(ctx, dest, pn, t + bar * 8 * b, b * 7.5, "sine", 0.04);
        }
      }
      const bassLine = [n("D", 2), n("F", 2), n("A", 2), n("G", 2), n("F", 2), n("E", 2), n("D", 2), n("A", 1)];
      for (let rep = 0; rep < 5; rep++) {
        for (let i = 0; i < bassLine.length; i++) {
          playNote(ctx, dest, bassLine[i], t + (8 + rep * 16 + i * 2) * b, b * 1.8, "sine", 0.09);
        }
      }
      for (let i = 8; i < 96; i += 4) {
        percHit(ctx, dest, t + i * b, 0.03, 45);
      }
    },
  },

  {
    bpm: 142,
    duration: 142,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      const lead1 = [
        n("E", 5), n("G", 5), n("B", 5), n("A", 5), n("G", 5), n("F#", 5), n("E", 5), n("D", 5),
        n("E", 5), n("F#", 5), n("G", 5), n("A", 5), n("B", 5), n("A", 5), n("G", 5), n("E", 5),
      ];
      const lead2 = [
        n("B", 5), n("A", 5), n("G", 5), n("F#", 5), n("E", 5), n("D", 5), n("E", 5), n("G", 5),
        n("A", 5), n("B", 5), n("E", 6), n("D", 6), n("B", 5), n("A", 5), n("G", 5), n("E", 5),
      ];
      const lead3 = [
        n("G", 5), n("A", 5), n("B", 5), n("E", 6), n("D", 6), n("B", 5), n("A", 5), n("G", 5),
        n("E", 5), n("F#", 5), n("G", 5), n("B", 5), n("A", 5), n("G", 5), n("F#", 5), n("E", 5),
      ];
      for (let rep = 0; rep < 3; rep++) {
        const off = rep * 48;
        for (let i = 0; i < lead1.length; i++) {
          playNote(ctx, dest, lead1[i], t + (off + i) * b, b * 0.6, "sawtooth", 0.15);
        }
        const l2 = rep === 2 ? lead3 : lead2;
        for (let i = 0; i < l2.length; i++) {
          playNote(ctx, dest, l2[i], t + (off + 16 + i) * b, b * 0.6, "square", 0.12);
        }
        for (let i = 0; i < lead1.length; i++) {
          playNote(ctx, dest, lead1[i] * (rep === 1 ? 2 : 1), t + (off + 32 + i) * b, b * 0.6, "triangle", 0.08);
        }
      }
      const harmNotes = [
        n("G", 4), n("B", 4), n("D", 5), n("E", 4), n("G", 4), n("B", 4),
        n("A", 4), n("C", 5), n("E", 5), n("G", 4), n("B", 4), n("D", 5),
      ];
      for (let rep = 0; rep < 10; rep++) {
        for (let i = 0; i < harmNotes.length; i++) {
          playNote(ctx, dest, harmNotes[i], t + (rep * 14 + i) * b, b * 1.2, "triangle", 0.05);
        }
      }
      const bassNotes = [n("E", 2), n("G", 2), n("A", 2), n("B", 2), n("A", 2), n("G", 2), n("E", 2), n("D", 2)];
      for (let rep = 0; rep < 9; rep++) {
        for (let i = 0; i < bassNotes.length; i++) {
          playNote(ctx, dest, bassNotes[i], t + (rep * 16 + i * 2) * b, b * 1.8, "sawtooth", 0.12);
        }
      }
      drone(ctx, dest, n("E", 2), t, 71 * b, 0.08, "sine");
      drone(ctx, dest, n("B", 2), t + 71 * b, 71 * b, 0.08, "sine");
      for (let i = 0; i < 142; i++) {
        if (i % 2 === 0) percHit(ctx, dest, t + i * b, 0.10, 85);
        hiHat(ctx, dest, t + (i + 0.5) * b, 0.06);
        if (i % 8 === 0) percHit(ctx, dest, t + i * b, 0.08, 35);
      }
      for (let i = 134; i < 142; i++) {
        playNote(ctx, dest, n("E", 5) * (1 + (142 - i) * 0.02), t + i * b, b * 0.8, "sawtooth", 0.10);
      }
    },
  },

  {
    bpm: 72,
    duration: 80,
    play(ctx, dest, t, bpm) {
      const b = beat(bpm);
      drone(ctx, dest, n("D", 2), t, 80 * b, 0.14, "sine");
      drone(ctx, dest, n("A", 1), t, 80 * b, 0.08, "sine");
      drone(ctx, dest, n("F", 2), t + 16 * b, 48 * b, 0.05, "triangle");
      drone(ctx, dest, n("D", 3), t + 40 * b, 40 * b, 0.04, "sine");
      const fadeMelody = [
        n("D", 5), n("A", 4), n("F", 4), n("D", 4), n("A", 3),
        n("D", 5), n("C", 5), n("A", 4), n("F", 4), n("D", 4),
        n("F", 4), n("A", 4), n("D", 5), n("C", 5), n("A", 4),
        n("G", 4), n("F", 4), n("D", 4), n("A", 3), n("D", 4),
        n("F", 4), n("A", 4), n("C", 5), n("A", 4), n("F", 4),
      ];
      for (let i = 0; i < fadeMelody.length; i++) {
        const vol = 0.12 * (1 - i / (fadeMelody.length * 1.5));
        playNote(ctx, dest, fadeMelody[i], t + (4 + i * 3) * b, b * 3.5, "triangle", Math.max(vol, 0.02));
      }
      const padFreqs = [n("D", 3), n("F", 3), n("A", 3)];
      for (let bar = 0; bar < 5; bar++) {
        for (const pf of padFreqs) {
          const vol = 0.05 * (1 - bar / 6);
          playNote(ctx, dest, pf, t + bar * 16 * b, b * 15, "sine", Math.max(vol, 0.01));
        }
      }
      for (let i = 60; i < 80; i += 4) {
        percHit(ctx, dest, t + i * b, 0.02 * (1 - (i - 60) / 25), 40);
      }
    },
  },
];

export class LavaTrack implements MusicTrack {
  private sectionIndex = 0;

  schedule(ctx: AudioContext, masterGain: GainNode, startTime: number): number {
    const section = sections[this.sectionIndex % sections.length];
    const beatDur = 60 / section.bpm;
    const sectionDur = section.duration * beatDur;

    section.play(ctx, masterGain, startTime, section.bpm);

    this.sectionIndex = (this.sectionIndex + 1) % sections.length;
    return sectionDur;
  }
}
