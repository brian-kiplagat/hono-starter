import { validator } from 'hono/validator';
import { z } from 'zod';

import { validateSchema } from './validator.js';

const createNotificationSchema = z.object({
  user_id: z.number().int().positive(),
  notification_type: z.enum(['comment', 'like', 'system', 'reminder']),
  message: z.string().min(1),
  link: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const createNotificationValidator = validator('json', (value, c) => {
  return validateSchema(c, createNotificationSchema, value);
});

const updateNotificationSchema = z.object({
  notification_type: z.enum(['comment', 'like', 'system', 'reminder']).optional(),
  message: z.string().min(1).optional(),
  link: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  is_read: z.boolean().optional(),
});

const updateNotificationValidator = validator('json', (value, c) => {
  return validateSchema(c, updateNotificationSchema, value);
});

const notificationQuerySchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  user_id: z.number().int().positive().optional(),
  notification_type: z.enum(['comment', 'like', 'system', 'reminder']).optional(),
  is_read: z.boolean().optional(),
});

const notificationQueryValidator = validator('query', (value, c) => {
  return validateSchema(c, notificationQuerySchema, value);
});

type CreateNotificationBody = z.infer<typeof createNotificationSchema>;
type UpdateNotificationBody = z.infer<typeof updateNotificationSchema>;
type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export {
  type CreateNotificationBody,
  createNotificationValidator,
  type NotificationQuery,
  notificationQueryValidator,
  type UpdateNotificationBody,
  updateNotificationValidator,
};
