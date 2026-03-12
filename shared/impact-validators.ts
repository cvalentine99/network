// shared/impact-validators.ts
import { z } from 'zod';

export const TimeWindowQuerySchema = z.object({
  from: z.coerce.number().optional().default(-300000),
  until: z.coerce.number().optional(),
  cycle: z.enum(['1sec', '30sec', '5min', '1hr', '24hr', 'auto']).optional().default('auto'),
});
