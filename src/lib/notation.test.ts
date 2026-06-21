import { describe, it, expect } from "vitest";
import { layoutNote, yForPosition, STAFF_BOTTOM, keySignatureGlyphs } from "./notation";
import { CLEFS, KEY_BY_ID, noteToMidi } from "./music";

describe("notation geometry sanity", () => {
  it("E4 in treble sits exactly on the bottom line y", () => {
    const g = layoutNote(noteToMidi("E4"), CLEFS.treble, KEY_BY_ID.C, "q", 100);
    expect(g.head.cy).toBeCloseTo(STAFF_BOTTOM, 5);
    expect(g.pos).toBe(0);
  });
  it("middle C in treble draws a ledger line below and sits below the staff", () => {
    const g = layoutNote(noteToMidi("C4"), CLEFS.treble, KEY_BY_ID.C, "q", 100);
    expect(g.pos).toBe(-2);
    expect(g.head.cy).toBeGreaterThan(STAFF_BOTTOM);
    expect(g.ledger.length).toBeGreaterThanOrEqual(1);
  });
  it("high C6 in treble draws ledger lines above the staff", () => {
    const g = layoutNote(noteToMidi("C6"), CLEFS.treble, KEY_BY_ID.C, "q", 100);
    expect(g.head.cy).toBeLessThan(yForPosition(8)); // above top line
    expect(g.ledger.length).toBeGreaterThanOrEqual(1);
  });
  it("F# in G major prints NO accidental (covered by signature)", () => {
    const g = layoutNote(noteToMidi("F#5"), CLEFS.treble, KEY_BY_ID.G, "q", 100);
    expect(g.accidental).toBeNull();
  });
  it("F natural in G major prints a natural sign", () => {
    const g = layoutNote(noteToMidi("F5"), CLEFS.treble, KEY_BY_ID.G, "q", 100);
    expect(g.accidental).not.toBeNull();
    expect(g.accidental!.char).toBe("♮");
  });
  it("G major signature lays out exactly one sharp glyph", () => {
    const { glyphs } = keySignatureGlyphs(KEY_BY_ID.G, CLEFS.treble, 60);
    expect(glyphs.length).toBe(1);
    expect(glyphs[0].char).toBe("♯");
  });
  it("Eb major signature lays out three flat glyphs", () => {
    const { glyphs } = keySignatureGlyphs(KEY_BY_ID.Eb, CLEFS.treble, 60);
    expect(glyphs.length).toBe(3);
    glyphs.forEach((gl) => expect(gl.char).toBe("♭"));
  });
});
