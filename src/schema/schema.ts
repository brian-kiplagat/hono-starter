import { relations } from 'drizzle-orm';
import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const userSchema = mysqlTable('user', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  phone: varchar('phone', { length: 100 }).notNull().default(''),
  dial_code: varchar('dial_code', { length: 10 }).notNull().default(''),
  password: varchar('password', { length: 255 }).notNull(),
  reset_token: varchar('reset_token', { length: 255 }),
  email_token: varchar('email_token', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  role: mysqlEnum('role', ['master', 'owner', 'host']).default('host'),
  profile_picture: text('profile_picture'),
  bio: varchar('bio', { length: 255 }),
  custom_id: varchar('custom_id', { length: 255 }),
  is_verified: boolean('is_verified').default(false),
  is_banned: boolean('is_banned').default(false),
  is_deleted: boolean('is_deleted').default(false),
  stripe_connect_id: varchar('stripe_connect_id', { length: 255 }),
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
  stripe_connect_status: mysqlEnum('stripe_connect_status', [
    'pending',
    'active',
    'rejected',
    'restricted',
  ]).default('pending'),
  subscription_id: varchar('subscription_id', { length: 255 }),
  subscription_product: mysqlEnum('subscription_product', [
    'free',
    'basic',
    'popular',
    'advanced',
  ]).default('free'),
  subscription_status: mysqlEnum('subscription_status', [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'paused',
    'unpaid',
  ]),
  trial_ends_at: timestamp('trial_ends_at'),
  stripe_oauth_state: varchar('stripe_oauth_state', { length: 255 }),
  google_id: varchar('google_id', { length: 255 }),
  google_access_token: varchar('google_access_token', { length: 255 }),
  auth_provider: mysqlEnum('auth_provider', ['local', 'google']).default('local'),
  stripe_product_id: varchar('stripe_product_id', { length: 255 }),
  stripe_price_id: varchar('stripe_price_id', { length: 255 }),
});

export const followUpEmailSchema = mysqlTable('follow_up_emails', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  follow_up_who_gets_it:
    json('follow_up_who_gets_it').$type<
      ('new_lead' | 'call_back' | 'registered_for_event' | 'attended_event')[]
    >(),
  timeline: int('timeline').notNull(),
  enabled: boolean('enabled').default(false),
});

export const notificationsSchema = mysqlTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: int('user_id')
    .references(() => userSchema.id)
    .notNull(),
  notification_type: mysqlEnum('notification_type', [
    'comment',
    'like',
    'system',
    'new_lead',
    'new_booking',
    'new_payment',
    'reminder',
  ]).notNull(),
  is_read: boolean('is_read').default(false),
  title: varchar('title', { length: 255 }),
  message: text('message'),
  link: text('link'),
  metadata: json('metadata'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const emailsSchema = mysqlTable('emails', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  subtitle: varchar('subtitle', { length: 255 }).notNull(),
  body: text('body').notNull(),
  button_text: varchar('button_text', { length: 255 }).notNull(),
  button_link: varchar('button_link', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
  checked: boolean('checked').default(false),
  starred: boolean('starred').default(false),
  flagged: boolean('flagged').default(false),
  host_id: int('host_id')
    .references(() => userSchema.id)
    .notNull(),
  status: mysqlEnum('status', ['draft', 'sent', 'failed']).default('draft'),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export type Email = typeof emailsSchema.$inferSelect;
export type Notification = typeof notificationsSchema.$inferSelect;
export type NewNotification = typeof notificationsSchema.$inferInsert;
export type NewEmail = typeof emailsSchema.$inferInsert;
export type User = typeof userSchema.$inferSelect;

export type NewUser = typeof userSchema.$inferInsert;

export type FollowUpEmail = typeof followUpEmailSchema.$inferSelect;
export type NewFollowUpEmail = typeof followUpEmailSchema.$inferInsert;

// Define relations

export const notificationRelations = relations(notificationsSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [notificationsSchema.user_id],
    references: [userSchema.id],
  }),
}));

export const followUpEmailRelations = relations(followUpEmailSchema, ({ one }) => ({
  user: one(userSchema, {
    fields: [followUpEmailSchema.user_id],
    references: [userSchema.id],
  }),
}));

// Define the relations

export const mailRelations = relations(emailsSchema, ({ one }) => ({
  host: one(userSchema, {
    fields: [emailsSchema.host_id],
    references: [userSchema.id],
  }),
}));

// Define relations
