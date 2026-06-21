import { describe, it, expect } from "vitest";
import {
  midiToNote,
  noteToMidi,
  noteLabel,
  diatonicStep,
  spellInKey,
  spellingToMidi,
  staffPosition,
  midiStaffPosition,
  CLEFS,
  KEY_BY_ID,
  keyAccidentalLetters,
  keyPitchClasses,
  SHARP_ORDER,
  FLAT_ORDER,
  midiToFreq,
  freqToNearestMidi,
  DURATIONS,
  dateSeed,
  seededRandom,
} from "./music";

describe("note names and MIDI", () => {
  it("middle C is MIDI 60, C4", () => {
    const n = midiToNote(60);
    expect(n.name).toBe("C");
    expect(n.octave).toBe(4);
    expect(n.pc).toBe(0);
  });

  it("A4 = 440 Hz = MIDI 69", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5);
    expect(freqToNearestMidi(440)).toBe(69);
  });

  it("round-trips SPN", () => {
    expect(noteToMidi("A4")).toBe(69);
    expect(noteToMidi("C#3")).toBe(49);
    expect(noteToMidi("Bb5")).toBe(82);
    expect(noteToMidi("C-1")).toBe(0);
    expect(noteLabel(69)).toBe("A4");
    expect(noteLabel(61, "flat")).toBe("Db4");
  });

  it("rejects invalid note names", () => {
    expect(() => noteToMidi("H4")).toThrow();
  });
});

describe("diatonic steps", () => {
  it("middle C (C4) is step 28", () => {
    expect(diatonicStep("C", 4)).toBe(28);
  });
  it("adjacent letters are one step apart", () => {
    expect(diatonicStep("D", 4) - diatonicStep("C", 4)).toBe(1);
    expect(diatonicStep("C", 5) - diatonicStep("B", 4)).toBe(1);
  });
  it("an octave is seven steps", () => {
    expect(diatonicStep("C", 5) - diatonicStep("C", 4)).toBe(7);
  });
});

describe("staff placement (the crux)", () => {
  const treble = CLEFS.treble;
  const bass = CLEFS.bass;
  const cMajor = KEY_BY_ID.C;

  it("treble bottom line is E4 at position 0", () => {
    expect(midiStaffPosition(noteToMidi("E4"), treble, cMajor)).toBe(0);
  });
  it("treble: G4 sits on the 2nd line (position 2)", () => {
    expect(midiStaffPosition(noteToMidi("G4"), treble, cMajor)).toBe(2);
  });
  it("treble: F5 is the top line (position 8)", () => {
    expect(midiStaffPosition(noteToMidi("F5"), treble, cMajor)).toBe(8);
  });
  it("treble: middle C (C4) is a ledger line below (position -2)", () => {
    expect(midiStaffPosition(noteToMidi("C4"), treble, cMajor)).toBe(-2);
  });
  it("bass bottom line is G2 at position 0", () => {
    expect(midiStaffPosition(noteToMidi("G2"), bass, cMajor)).toBe(0);
  });
  it("bass: middle C (C4) sits a ledger line above (position 10)", () => {
    expect(midiStaffPosition(noteToMidi("C4"), bass, cMajor)).toBe(10);
  });
  it("bass: D3 is the middle line (position 4)", () => {
    expect(midiStaffPosition(noteToMidi("D3"), bass, cMajor)).toBe(4);
  });
});

describe("key signatures", () => {
  it("C major has no accidentals", () => {
    expect(keyAccidentalLetters(KEY_BY_ID.C)).toEqual([]);
    expect(KEY_BY_ID.C.count).toBe(0);
  });
  it("G major has one sharp: F#", () => {
    expect(keyAccidentalLetters(KEY_BY_ID.G)).toEqual(["F"]);
  });
  it("D major sharps F and C, in order", () => {
    expect(keyAccidentalLetters(KEY_BY_ID.D)).toEqual(["F", "C"]);
  });
  it("Eb major flats B, E, A, in order", () => {
    expect(keyAccidentalLetters(KEY_BY_ID.Eb)).toEqual(["B", "E", "A"]);
  });
  it("sharp/flat order constants are the classic sequences", () => {
    expect(SHARP_ORDER).toEqual(["F", "C", "G", "D", "A", "E", "B"]);
    expect(FLAT_ORDER).toEqual(["B", "E", "A", "D", "G", "C", "F"]);
  });

  it("G major's scale is G A B C D E F# (pitch classes)", () => {
    expect(keyPitchClasses(KEY_BY_ID.G)).toEqual([0, 2, 4, 6, 7, 9, 11]);
  });
  it("F major's scale contains Bb (pc 10), not B (pc 11)", () => {
    const pcs = keyPitchClasses(KEY_BY_ID.F);
    expect(pcs).toContain(10);
    expect(pcs).not.toContain(11);
  });
});

describe("spelling in key", () => {
  it("in G major, F# is spelled F with a sharp (no printed accidental)", () => {
    const s = spellInKey(noteToMidi("F#4"), KEY_BY_ID.G);
    expect(s.letter).toBe("F");
    expect(s.accidental).toBe(1);
    expect(s.octave).toBe(4);
    expect(spellingToMidi(s)).toBe(noteToMidi("F#4"));
  });
  it("in C major, a black key (MIDI 61) spells as C#", () => {
    const s = spellInKey(61, KEY_BY_ID.C);
    expect(s.letter).toBe("C");
    expect(s.accidental).toBe(1);
  });
  it("in Eb major, the same MIDI 61 spells as Db (flat flavour)", () => {
    const s = spellInKey(61, KEY_BY_ID.Eb);
    expect(s.letter).toBe("D");
    expect(s.accidental).toBe(-1);
  });
  it("spelling always reproduces the original MIDI", () => {
    for (const keyId of ["C", "G", "D", "F", "Bb", "Eb"]) {
      const key = KEY_BY_ID[keyId];
      for (let m = 36; m <= 84; m++) {
        expect(spellingToMidi(spellInKey(m, key))).toBe(m);
      }
    }
  });
});

describe("staffPosition is monotonic with pitch", () => {
  it("higher diatonic notes never sit lower on the staff", () => {
    const treble = CLEFS.treble;
    const key = KEY_BY_ID.C;
    let prev = -Infinity;
    for (const spn of ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5"]) {
      const s = spellInKey(noteToMidi(spn), key);
      const pos = staffPosition(s, treble);
      expect(pos).toBeGreaterThan(prev);
      prev = pos;
    }
  });
});

describe("rhythm durations", () => {
  it("quarter = 1 beat, half = 2, whole = 4, eighth = 0.5", () => {
    expect(DURATIONS.q.beats).toBe(1);
    expect(DURATIONS.h.beats).toBe(2);
    expect(DURATIONS.w.beats).toBe(4);
    expect(DURATIONS["8"].beats).toBe(0.5);
    expect(DURATIONS["16"].beats).toBe(0.25);
  });
});

describe("seeded daily generator", () => {
  it("is deterministic for a given date", () => {
    const a = seededRandom(dateSeed("2026-06-20"));
    const b = seededRandom(dateSeed("2026-06-20"));
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("differs across dates", () => {
    const a = seededRandom(dateSeed("2026-06-20"))();
    const b = seededRandom(dateSeed("2026-06-21"))();
    expect(a).not.toBe(b);
  });
});
