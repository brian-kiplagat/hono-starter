import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import type { EmailRepository } from '../repository/email.ts';
import type {
  Business,
  Email,
  FollowUpEmail,
  NewEmail,
  NewFollowUpEmail,
  User,
} from '../schema/schema.ts';
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
  public async bulkAddEmails(
    bulkEmails: NewEmail[],
    user: User,
    business: Business,
  ): Promise<{ count: number; emails: string[] }> {
    try {
      // Check if we have any emails to process
      if (!bulkEmails || bulkEmails.length === 0) {
        throw new Error('No emails to process');
      }

      //record only only one single email from the bulk data for record keeping
      await this.repository.createEmail({
        email: user.email,
        subject: bulkEmails[0].subject,
        title: bulkEmails[0].title,
        subtitle: bulkEmails[0].subtitle,
        body: bulkEmails[0].body,
        button_text: bulkEmails[0].button_text,
        button_link: bulkEmails[0].button_link,
        host_id: bulkEmails[0].host_id,
      });
      // Queue each email for processing
      const promises = bulkEmails.map((email) =>
        processEmailAsync({
          email: email.email,
          name: email.email.split('@')[0], // Use email prefix as name
          templateId: 2, // Use appropriate template ID
          emailData: {
            subject: email.subject,
            title: email.title,
            subtitle: email.subtitle,
            body: email.body,
            buttonText: email.button_text,
            buttonLink: email.button_link,
            username: email.email.split('@')[0] || 'User',
            eventname: email.title,
            eventdate: email.subtitle,
            eventtime: email.body.split(' ')[0],
            eventlink: email.button_link,
            busname: business.name,
            busemail: business.email || '',
            busaddress: business.address || '',
          },
        }),
      );
      await Promise.all(promises);
      return {
        count: bulkEmails.length,
        emails: bulkEmails.map((email) => email.email),
      };
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

  /**
   * Creates a follow up email template
   * @param {NewFollowUpEmail} data - The follow up email data to create
   * @returns {Promise<number>} The ID of the created follow up email
   * @throws {Error} When follow up email creation fails
   */
  public async createFollowUpEmail(data: NewFollowUpEmail): Promise<number> {
    try {
      const followUpEmail = await this.repository.createFollowUpEmail(data);
      return followUpEmail[0].id;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /** Get all follow up emails
   * @param {number} userId - The ID of the user
   * @returns {Promise<FollowUpEmail[]>} The follow up emails
   * @throws {Error} When follow up email retrieval fails
   */
  public async getFollowUpEmails(userId: number): Promise<FollowUpEmail[]> {
    try {
      return await this.repository.findFollowUpEmailsByUserId(userId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /** Get enabled follow up emails by user ID
   * @param {number} userId - The ID of the user
   * @returns {Promise<FollowUpEmail[]>} The enabled follow up emails
   * @throws {Error} When enabled follow up email retrieval fails
   */
  public async getEnabledFollowUpEmails(userId: number): Promise<FollowUpEmail[]> {
    try {
      return await this.repository.findEnabledFollowUpEmailsByUserId(userId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /** Get specific follow-up email by user ID and timeline (optimized for single lookup)
   * @param {number} userId - The ID of the user
   * @param {number} timeline - The timeline of the follow up email
   * @param {boolean} enabled - Whether the follow up email is enabled
   * @returns {Promise<FollowUpEmail | undefined>} The enabled follow up email
   * @throws {Error} When enabled follow up email retrieval fails
   */
  public async getEnabledFollowUpEmailByTimeline(
    userId: number,
    timeline: number,
    enabled: boolean,
  ): Promise<FollowUpEmail | undefined> {
    try {
      return await this.repository.findEnabledFollowUpEmailsByUserIdAndTimeline(
        userId,
        timeline,
        enabled,
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Updates a follow up email template
   * @param {number} id - The ID of the follow up email to update
   * @param {Partial<FollowUpEmail>} data - The updated follow up email data
   * @returns {Promise<void>}
   * @throws {Error} When follow up email update fails
   */
  public async updateFollowUpEmail(id: number, data: Partial<FollowUpEmail>): Promise<void> {
    try {
      await this.repository.updateFollowUpEmail(id, data);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Deletes a follow up email template from the system
   * @param {number} id - The ID of the follow up email to delete
   * @returns {Promise<void>}
   * @throws {Error} When follow up email deletion fails
   */
  public async deleteFollowUpEmail(id: number): Promise<void> {
    try {
      await this.repository.deleteFollowUpEmail(id);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
