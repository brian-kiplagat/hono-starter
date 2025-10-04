import { and, eq } from 'drizzle-orm';

import { db } from '../lib/database.ts';
import type { Email, FollowUpEmail, NewEmail, NewFollowUpEmail } from '../schema/schema.ts';
import { emailsSchema, followUpEmailSchema } from '../schema/schema.ts';

export class EmailRepository {
  public async createEmail(data: NewEmail) {
    return db.insert(emailsSchema).values(data).$returningId();
  }

  public async createFollowUpEmail(data: NewFollowUpEmail) {
    return db.insert(followUpEmailSchema).values(data).$returningId();
  }

  public async bulkAddEmails(data: NewEmail[]) {
    return db.insert(emailsSchema).values(data).$returningId();
  }

  public async findEmailById(id: number) {
    return db.query.emailsSchema.findFirst({
      where: eq(emailsSchema.id, id),
    });
  }

  public async findFollowUpEmailsByUserId(userId: number) {
    return db.query.followUpEmailSchema.findMany({
      where: eq(followUpEmailSchema.user_id, userId),
    });
  }

  public async findEmailsByHostId(hostId: number) {
    return db.query.emailsSchema.findMany({
      where: eq(emailsSchema.host_id, hostId),
      orderBy: (emails, { desc }) => [desc(emails.created_at)],
    });
  }

  public async updateEmail(id: number, data: Partial<Email>) {
    return db.update(emailsSchema).set(data).where(eq(emailsSchema.id, id));
  }

  public async deleteEmail(id: number) {
    return db.delete(emailsSchema).where(eq(emailsSchema.id, id));
  }

  public async softDeleteEmail(id: number) {
    return db.update(emailsSchema).set({ status: 'sent' }).where(eq(emailsSchema.id, id));
  }

  public async deleteFollowUpEmail(id: number) {
    return db.delete(followUpEmailSchema).where(eq(followUpEmailSchema.id, id));
  }

  public async findEnabledFollowUpEmailsByUserId(userId: number) {
    return db.query.followUpEmailSchema.findMany({
      where: and(eq(followUpEmailSchema.user_id, userId), eq(followUpEmailSchema.enabled, true)),
      orderBy: (followUpEmails, { asc }) => [asc(followUpEmails.timeline)],
    });
  }

  // Optimized lookup for timeline of specific days
  public async findEnabledFollowUpEmailsByUserIdAndTimeline(
    userId: number,
    timeline: number,
    enabled: boolean,
  ) {
    return db.query.followUpEmailSchema.findFirst({
      where: and(
        eq(followUpEmailSchema.user_id, userId),
        eq(followUpEmailSchema.enabled, enabled),
        eq(followUpEmailSchema.timeline, timeline),
      ),
    });
  }

  public async findFollowUpEmailById(id: number) {
    return db.query.followUpEmailSchema.findFirst({
      where: eq(followUpEmailSchema.id, id),
    });
  }

  public async updateFollowUpEmail(id: number, data: Partial<FollowUpEmail>) {
    return db.update(followUpEmailSchema).set(data).where(eq(followUpEmailSchema.id, id));
  }
}
