import { z } from 'zod';

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  role: z.enum(['master', 'owner', 'host', 'user']).optional(),
  search: z.string().optional(),
});

export const adminLeadQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  status: z.enum(['Manual', 'Form', 'Interested', 'Member', 'Inactive Member']).optional(),
  membership_level: z.enum(['Silver', 'Gold', 'Platinum']).optional(),
  search: z.string().optional(),
});

export const adminEventQuerySchema = z.object({
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
  date_range: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminLeadQuery = z.infer<typeof adminLeadQuerySchema>;
export type AdminEventQuery = z.infer<typeof adminEventQuerySchema>;
