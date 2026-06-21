// ─────────────────────────────────────────────────────────────────────────
// Monophonic pitch detection via the autocorrelation / "MPM"-style method
// with parabolic interpolation. Returns frequency in Hz (or null if unvoiced).
// Tuned for sung / single-instrument input in the ~70–1100 Hz range.
// ─────────────────────────────────────────────────────────────────────────

export interface PitchResult {
  freq: number;
  /** Clarity 0..1 — how periodic the signal looked. */
  clarity: number;
}

/**
 * Detect fundamental frequency from a Float32 time-domain buffer.
 * Uses normalized square difference (NSDF) peak picking + parabolic refine.
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  opts: { minFreq?: number; maxFreq?: number; threshold?: number } = {},
): PitchResult | null {
  const minFreq = opts.minFreq ?? 70;
  const maxFreq = opts.maxFreq ?? 1100;
  const clarityThreshold = opts.threshold ?? 0.9;

  const n = buf.length;

  // RMS gate — ignore near-silence.
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null;

  const maxLag = Math.min(n - 1, Math.floor(sampleRate / minFreq));
  const minLag = Math.max(1, Math.floor(sampleRate / maxFreq));

  // Normalized square difference function.
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i + lag < n; i++) {
      acf += buf[i] * buf[i + lag];
      m += buf[i] * buf[i] + buf[i + lag] * buf[i + lag];
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0;
  }

  // McLeod peak-picking: collect the maxima between positively-going and
  // negatively-going zero crossings, then choose the FIRST peak whose value
  // clears a fraction of the global max. Picking the first (smallest-lag)
  // strong peak avoids octave errors where a sub-harmonic peak is slightly
  // taller than the true fundamental's peak.
  interface Peak {
    lag: number;
    val: number;
  }
  const peaks: Peak[] = [];
  let globalMax = 0;
  let lag = minLag;
  // Walk every positive lobe in [minLag, maxLag] and take its local maximum.
  // We start collecting immediately (even if minLag lands mid-lobe) so the
  // fundamental's peak is never skipped.
  while (lag <= maxLag) {
    // skip any non-positive region
    while (lag <= maxLag && nsdf[lag] <= 0) lag++;
    // find the local maximum within this positive lobe
    let curLag = -1;
    let curVal = -Infinity;
    while (lag <= maxLag && nsdf[lag] > 0) {
      if (nsdf[lag] > curVal) {
        curVal = nsdf[lag];
        curLag = lag;
      }
      lag++;
    }
    if (curLag > 0) {
      peaks.push({ lag: curLag, val: curVal });
      if (curVal > globalMax) globalMax = curVal;
    }
  }

  if (peaks.length === 0 || globalMax < 0.5) return null;

  const cutoff = clarityThreshold * globalMax;
  const chosen = peaks.find((p) => p.val >= cutoff) ?? peaks[0];
  const bestLag = chosen.lag;
  const bestVal = chosen.val;

  // Parabolic interpolation around the peak for sub-sample lag accuracy.
  const x0 = nsdf[bestLag - 1];
  const x1 = nsdf[bestLag];
  const x2 = nsdf[bestLag + 1];
  const denom = x0 - 2 * x1 + x2;
  const shift = denom !== 0 ? (0.5 * (x0 - x2)) / denom : 0;
  const refinedLag = bestLag + shift;

  const freq = sampleRate / refinedLag;
  if (freq < minFreq || freq > maxFreq) return null;

  return { freq, clarity: bestVal };
}
