import { eq } from 'drizzle-orm';

import { db } from '../lib/database.ts';
import type { Email, NewEmail } from '../schema/schema.ts';
import { emailsSchema } from '../schema/schema.ts';

export class EmailRepository {
  public async createEmail(data: NewEmail) {
    return db.insert(emailsSchema).values(data).$returningId();
  }

  public async bulkAddEmails(data: NewEmail[]) {
    return db.insert(emailsSchema).values(data).$returningId();
  }

  public async findEmailById(id: number) {
    return db.query.emailsSchema.findFirst({
      where: eq(emailsSchema.id, id),
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
}
