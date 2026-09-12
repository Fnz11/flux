import type { Vault } from "@/types";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getEffectiveSparkline(
  vault: Partial<Vault> & {
    id?: string;
    address?: string;
    pnlPercent?: number;
    tvl?: number;
  },
): number[] {
  if (vault.sparkline && vault.sparkline.length >= 2) {
    return vault.sparkline;
  }

  const pnlPercent =
    typeof vault.pnlPercent === "number"
      ? vault.pnlPercent
      : Number(vault.pnlPercent) || 0;
  const isPositive = pnlPercent >= 0;
  const seed = hashString(
    vault.id || vault.address || vault.metadata?.displayName || "vault",
  );

  const stepCount = 14;
  const points: number[] = [];

  // Minimum visual slope magnitude so tiny 0.01% changes still look convincingly directional
  const visualMagnitude = Math.max(
    0.2,
    Math.min(0.65, Math.abs(pnlPercent) * 0.06 + 0.2),
  );

  // Start and end values:
  // If positive: starts low, ends higher
  // If negative: starts high, ends lower
  const startVal = isPositive ? 100 : 100 * (1 + visualMagnitude);
  const endVal = isPositive ? 100 * (1 + visualMagnitude) : 100;
  const slopeDelta = endVal - startVal;

  // Unique deterministic harmonics per vault seed
  const freq1 = 1.0 + ((seed % 100) / 100) * 1.5;
  const freq2 = 2.2 + (((seed >> 3) % 100) / 100) * 1.8;
  const phase1 = ((seed >> 6) % 100) / 10;

  // Max noise amplitude is constrained so trend ALWAYS dominates
  const maxNoise = Math.abs(slopeDelta) * 0.24;
  const noiseWeight1 = 0.6 + (((seed >> 9) % 100) / 100) * 0.4;
  const noiseWeight2 = 0.3 + (((seed >> 12) % 100) / 100) * 0.3;

  for (let i = 0; i < stepCount; i++) {
    const t = i / (stepCount - 1);

    // Smooth monotonic trend line
    const smoothT = t * t * (3 - 2 * t);
    const trend = startVal + slopeDelta * (0.5 * t + 0.5 * smoothT);

    // Noise is enveloped by 4 * t * (1 - t) so it strictly equals 0 at both endpoints
    const envelope = 4 * t * (1 - t);
    const noise =
      (Math.sin(t * Math.PI * freq1 + phase1) * noiseWeight1 +
        Math.cos(t * Math.PI * freq2 + phase1 * 0.5) * noiseWeight2) *
      maxNoise *
      envelope;

    points.push(trend + noise);
  }

  return points;
}

