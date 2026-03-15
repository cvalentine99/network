/**
 * Protocol Breakdown Chart — Zod validators (Slice 16)
 *
 * CONTRACT:
 *   - Validates ProtocolChartEntry and ProtocolChartData shapes
 *   - Enforces non-negative numbers, valid percentages, non-empty protocol names
 *   - Used in tests to prove normalization output conforms to contract
 */
import { z } from 'zod';

export const ProtocolChartEntrySchema = z.object({
  protocol: z.string().min(1),
  totalBytes: z.number().nonnegative().finite(),
  bytesIn: z.number().nonnegative().finite(),
  bytesOut: z.number().nonnegative().finite(),
  connections: z.number().int().nonnegative().finite(),
  pct: z.number().min(0).max(100).finite(),
  color: z.string().min(1),
});

export const ProtocolChartDataSchema = z.object({
  entries: z.array(ProtocolChartEntrySchema),
  grandTotal: z.number().nonnegative().finite(),
  protocolCount: z.number().int().nonnegative(),
  isEmpty: z.boolean(),
}).refine(
  (data) => {
    // If isEmpty is true, entries must be empty and grandTotal must be 0
    if (data.isEmpty) {
      return data.entries.length === 0 && data.grandTotal === 0 && data.protocolCount === 0;
    }
    return true;
  },
  { message: 'isEmpty=true requires entries=[], grandTotal=0, protocolCount=0' }
).refine(
  (data) => {
    // If not empty, entries must have at least one entry
    if (!data.isEmpty) {
      return data.entries.length > 0;
    }
    return true;
  },
  { message: 'isEmpty=false requires at least one entry' }
).refine(
  (data) => {
    // Percentages should sum to approximately 100 (within rounding tolerance)
    if (data.entries.length === 0) return true;
    const pctSum = data.entries.reduce((sum, e) => sum + e.pct, 0);
    return Math.abs(pctSum - 100) < 1; // Allow 1% rounding tolerance
  },
  { message: 'Entry percentages must sum to approximately 100%' }
);
