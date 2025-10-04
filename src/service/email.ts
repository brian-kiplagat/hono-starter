import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import type { EmailRepository } from '../repository/email.ts';
import type { Email, NewEmail } from '../schema/schema.ts';
import processBulkEmailAsync from '../task/client/processBulkEmail.ts';
import processEmailAsync from '../task/client/processEmailAsync.ts';

export class EmailService {
  private repository: EmailRepository;

  constructor(repository: EmailRepository) {
    this.repository = repository;
  }

  /**
   * Creates a new email template in the system
   * @param {NewEmail} data - The email data to create
   * @returns {Promise<number>} The ID of the created email
   * @throws {Error} When email creation fails
   */
  public async createEmail(data: NewEmail): Promise<number> {
    try {
      const email = await this.repository.createEmail(data);
      // Queue the email for processing
      await processEmailAsync({
        email: data.email,
        name: data.email.split('@')[0],
        templateId: 12,
        emailData: {
          subject: data.subject,
          title: data.title,
          subtitle: data.subtitle,
          body: data.body,
          buttonText: data.button_text,
          buttonLink: data.button_link,
          username: data.email.split('@')[0] || 'User',
          eventname: '',
          eventdate: '',
          eventtime: '',
          eventlink: '',
          busname: env.BRAND_NAME,
          busemail: '',
          busaddress: '',
        },
      });
      return email[0].id;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Bulk adds emails to the database
   * @param {NewEmail[]} data - The email data to bulk add
   * @returns {Promise<number>} The number of emails added
   * @throws {Error} When email bulk addition fails
   */

  public async bulkSendFollowUpEmails(
    data: {
      email: string;
      name: string;
      params: Record<string, string>;
      templateId: number;
    }[],
  ): Promise<number> {
    try {
      // Queue each email for processing
      const promises = data.map((item) =>
        processBulkEmailAsync({
          email: item.email,
          name: item.name,
          templateId: item.templateId, // Use appropriate template ID
          params: item.params,
        }),
      );
      await Promise.all(promises);
      return data.length;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves a specific email template by its ID
   * @param {number} id - The ID of the email to retrieve
   * @returns {Promise<Email | undefined>} The email template if found, undefined otherwise
   * @throws {Error} When email retrieval fails
   */
  public async getEmail(id: number): Promise<Email | undefined> {
    try {
      return await this.repository.findEmailById(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all email templates for a specific host
   * @param {number} hostId - The ID of the host
   * @returns {Promise<Email[]>} Array of email templates
   * @throws {Error} When email retrieval fails
   */
  public async getEmails(hostId: number): Promise<Email[]> {
    try {
      return await this.repository.findEmailsByHostId(hostId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Retrieves all email templates for a specific host
   * @param {number} hostId - The ID of the host
   * @returns {Promise<Email[]>} Array of email templates
   * @throws {Error} When email retrieval fails
   */
  public async getEmailsByHostId(hostId: number): Promise<Email[]> {
    try {
      return await this.repository.findEmailsByHostId(hostId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Updates an existing email template
   * @param {number} id - The ID of the email to update
   * @param {Partial<Email>} data - The updated email data
   * @returns {Promise<void>}
   * @throws {Error} When email update fails
   */
  public async updateEmail(id: number, data: Partial<Email>): Promise<void> {
    try {
      await this.repository.updateEmail(id, data);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Deletes an email template from the system
   * @param {number} id - The ID of the email to delete
   * @returns {Promise<void>}
   * @throws {Error} When email deletion fails
   */
  public async deleteEmail(id: number): Promise<void> {
    try {
      await this.repository.deleteEmail(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Soft deletes an email template from the system (marks as deleted but preserves the record)
   * @param {number} id - The ID of the email to soft delete
   * @returns {Promise<void>}
   * @throws {Error} When email soft deletion fails
   */
  public async softDeleteEmail(id: number): Promise<void> {
    try {
      await this.repository.softDeleteEmail(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Toggles either the flagged or starred status of a bulk email
   * @param {number} id - The ID of the email to toggle
   * @param {string} action - The action to perform ('flag' or 'star')
   * @returns {Promise<void>}
   * @throws {Error} When email toggle fails
   */
  public async toggleBulkEmail(id: number, action: 'flag' | 'star'): Promise<void> {
    try {
      const email = await this.repository.findEmailById(id);
      if (!email) {
        throw new Error('Email not found');
      }

      const updateData =
        action === 'flag' ? { flagged: !email.flagged } : { starred: !email.starred };

      await this.repository.updateEmail(id, updateData);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
