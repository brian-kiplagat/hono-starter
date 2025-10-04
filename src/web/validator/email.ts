import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const bulkEmailSchema = z.object({
  subject: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  subtitle: z.string().min(1).max(255),
  body: z.string().min(1),
  button_text: z.string().min(1).max(255),
  button_link: z.string().url().max(255),
  type: z.enum(['event', 'tag', 'name']),
  filterType: z.enum(['everyone', 'attended', 'notAttended']),
  recipients: z.array(z.number()),
  selectedMembership: z.number().optional(),
});

const bulkEmailValidator = validator('json', (value, c) => {
  return validateSchema(c, bulkEmailSchema, value);
});

const toggleBulkEmailSchema = z.object({
  id: z.number(),
  action: z.enum(['flag', 'star']),
});

const toggleBulkEmailValidator = validator('json', (value, c) => {
  return validateSchema(c, toggleBulkEmailSchema, value);
});

const updatebulkEmailSchema = z.object({
  email: z.string().email().optional(),
  subject: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  subtitle: z.string().min(1).max(255).optional(),
  body: z.string().min(1).optional(),
  button_text: z.string().min(1).max(255).optional(),
  button_link: z.string().url().max(255).optional(),
});

const createBulkEmailSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  follow_up_who_gets_it: z.array(
    z.enum(['new_lead', 'call_back', 'registered_for_event', 'attended_event']),
  ),
  timeline: z.number(),
  user_id: z.number(),
});

const updateFollowUpEmailSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  follow_up_who_gets_it: z
    .array(z.enum(['new_lead', 'call_back', 'registered_for_event', 'attended_event']))
    .optional(),
  timeline: z.number().optional(),
  enabled: z.boolean().optional(),
});

const createBulkEmailValidator = validator('json', (value, c) => {
  return validateSchema(c, createBulkEmailSchema, value);
});

const updateFollowUpEmailValidator = validator('json', (value, c) => {
  return validateSchema(c, updateFollowUpEmailSchema, value);
});

const updateBulkEmailValidator = validator('json', (value, c) => {
  return validateSchema(c, updatebulkEmailSchema, value);
});

type BulkEmailBody = z.infer<typeof bulkEmailSchema>;
type ToggleBulkEmailBody = z.infer<typeof toggleBulkEmailSchema>;
type UpdateBulkEmailBody = z.infer<typeof updatebulkEmailSchema>;
type CreateBulkEmailBody = z.infer<typeof createBulkEmailSchema>;
type UpdateFollowUpEmailBody = z.infer<typeof updateFollowUpEmailSchema>;

export {
  type BulkEmailBody,
  bulkEmailValidator,
  type CreateBulkEmailBody,
  createBulkEmailValidator,
  type ToggleBulkEmailBody,
  toggleBulkEmailSchema,
  toggleBulkEmailValidator,
  type UpdateBulkEmailBody,
  updateBulkEmailValidator,
  type UpdateFollowUpEmailBody,
  updateFollowUpEmailValidator,
};
