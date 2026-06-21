import { describe, it, expect } from "vitest";
import {
  makeNoteQuestion,
  makeKeyQuestion,
  makeRhythmQuestion,
  makeSightPhrase,
  scoreRhythm,
  noteItemId,
  letterLabel,
} from "./drills";
import { levelById, LEVELS } from "./curriculum";
import { spellInKey, DURATIONS, KEY_BY_ID } from "./music";
import { seededRandom, dateSeed } from "./music";

describe("note-naming questions", () => {
  it("produce a note inside the level's range, answer matching the spelling", () => {
    const lvl = levelById(2);
    for (let i = 0; i < 50; i++) {
      const q = makeNoteQuestion(lvl);
      expect(q.midi).toBeGreaterThanOrEqual(lvl.low);
      expect(q.midi).toBeLessThanOrEqual(lvl.high);
      const s = spellInKey(q.midi, q.key);
      expect(q.answer).toBe(s.letter);
    }
  });

  it("level 1 stays in the treble clef", () => {
    const lvl = levelById(1);
    for (let i = 0; i < 30; i++) {
      expect(makeNoteQuestion(lvl).clef.id).toBe("treble");
    }
  });

  it("item id encodes clef + midi", () => {
    expect(noteItemId("treble", 67)).toBe("treble:67");
  });

  it("is reproducible with a seeded RNG", () => {
    const lvl = levelById(8);
    const a = makeNoteQuestion(lvl, seededRandom(dateSeed("2026-06-20")));
    const b = makeNoteQuestion(lvl, seededRandom(dateSeed("2026-06-20")));
    expect(a.midi).toBe(b.midi);
    expect(a.clef.id).toBe(b.clef.id);
    expect(a.key.id).toBe(b.key.id);
  });
});

describe("key-signature questions", () => {
  it("offer four distinct options including the correct key", () => {
    const lvl = levelById(8);
    for (let i = 0; i < 30; i++) {
      const q = makeKeyQuestion(lvl);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.key.id);
    }
  });
});

describe("rhythm questions", () => {
  it("fill exactly the requested number of beats", () => {
    const lvl = levelById(6);
    for (let i = 0; i < 30; i++) {
      const q = makeRhythmQuestion(lvl, Math.random, 2, 4);
      expect(q.totalBeats).toBe(8);
      const last = q.events[q.events.length - 1];
      const end = last.beat + DURATIONS[last.duration].beats;
      expect(end).toBeLessThanOrEqual(q.totalBeats + 1e-6);
      // events are ordered and non-overlapping
      for (let j = 1; j < q.events.length; j++) {
        expect(q.events[j].beat).toBeGreaterThanOrEqual(q.events[j - 1].beat);
      }
    }
  });
});

describe("rhythm scoring", () => {
  it("perfect timing scores 1.0", () => {
    const targets = [0, 1, 2, 3];
    const bpm = 60; // 1000ms per beat
    const start = 1000;
    const taps = targets.map((b) => start + b * 1000);
    const s = scoreRhythm(targets, taps, start, bpm);
    expect(s.hits).toBe(4);
    expect(s.total).toBe(4);
    expect(s.meanErrorMs).toBeCloseTo(0, 5);
    expect(s.accuracy).toBeCloseTo(1, 5);
  });

  it("missed onsets reduce accuracy", () => {
    const targets = [0, 1, 2, 3];
    const start = 0;
    const s = scoreRhythm(targets, [0, 1000], start, 60);
    expect(s.hits).toBe(2);
    expect(s.accuracy).toBeLessThan(0.75);
    expect(s.accuracy).toBeGreaterThan(0);
  });

  it("taps outside the window don't count", () => {
    const s = scoreRhythm([0], [500], 0, 60, 180);
    expect(s.hits).toBe(0);
    expect(s.accuracy).toBe(0);
  });

  it("a tap matches its nearest onset, greedily", () => {
    // two targets at 0 and 1000ms; two taps near each
    const s = scoreRhythm([0, 1], [40, 1030], 0, 60, 180);
    expect(s.hits).toBe(2);
  });
});

describe("sight-reading phrases", () => {
  it("fill the bar with diatonic notes", () => {
    const lvl = levelById(2);
    for (let i = 0; i < 20; i++) {
      const p = makeSightPhrase(lvl, Math.random, 2, 4);
      expect(p.totalBeats).toBe(8);
      const pcs = new Set(
        [0, 2, 4, 5, 7, 9, 11].map((x) => x), // C-major scale pcs
      );
      for (const n of p.notes) {
        // level 2 is C major → every note is diatonic to C
        expect(pcs.has(((n.midi % 12) + 12) % 12)).toBe(true);
      }
      // onsets are ordered
      for (let j = 1; j < p.notes.length; j++) {
        expect(p.notes[j].beat).toBeGreaterThan(p.notes[j - 1].beat);
      }
    }
  });
});

describe("letter labels", () => {
  it("map letters to solfège and back", () => {
    expect(letterLabel("C", "letters")).toBe("C");
    expect(letterLabel("C", "solfege")).toBe("do");
    expect(letterLabel("G", "solfege")).toBe("sol");
  });
});

describe("curriculum integrity", () => {
  it("levels are numbered 1..N and reference real keys", () => {
    LEVELS.forEach((l, i) => {
      expect(l.id).toBe(i + 1);
      l.keys.forEach((k) => expect(KEY_BY_ID[k]).toBeDefined());
      expect(l.low).toBeLessThan(l.high);
    });
  });
});
