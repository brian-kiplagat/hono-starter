import type { Context } from 'hono';

import { EmailService } from '../../service/email.ts';
import { UserService } from '../../service/user.ts';
import type { ToggleBulkEmailBody, UpdateBulkEmailBody } from '../validator/email.ts';
import { ERRORS, serveBadRequest } from './resp/error.ts';

export class EmailController {
  private service: EmailService;
  private userService: UserService;
  constructor(service: EmailService, userService: UserService) {
    this.service = service;
    this.userService = userService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private async getUser(c: Context) {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  }

  /**
   * Retrieves a specific email template by ID
   * @param {Context} c - The Hono context containing email ID
   * @returns {Promise<Response>} Response containing email details or error message
   * @throws {Error} When fetching email details fails
   */
  public getEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const id = parseInt(c.req.param('id'));
      const email = await this.service.getEmail(id);
      if (!email) {
        return c.json({ error: 'Email not found' }, 404);
      }
      return c.json(email);
    } catch (error) {
      console.error('Error getting email:', error);
      return c.json({ error: 'Failed to get email' }, 500);
    }
  };

  /**
   * Retrieves all email templates for the current user
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing list of emails or error message
   * @throws {Error} When fetching emails fails
   */
  public getEmails = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const emails = await this.service.getEmails(user.id);
      return c.json(emails);
    } catch (error) {
      console.error('Error getting emails:', error);
      return c.json({ error: 'Failed to get emails' }, 500);
    }
  };

  /**
   * Retrieves all email templates for a specific host
   * @param {Context} c - The Hono context containing host ID
   * @returns {Promise<Response>} Response containing list of emails or error message
   * @throws {Error} When fetching emails fails
   */
  public getEmailsByHostId = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const hostId = c.get('user').id;
      const emails = await this.service.getEmailsByHostId(hostId);
      return c.json(emails);
    } catch (error) {
      console.error('Error getting emails:', error);
      return c.json({ error: 'Failed to get emails' }, 500);
    }
  };

  /**
   * Updates an existing email template
   * @param {Context} c - The Hono context containing updated email information
   * @returns {Promise<Response>} Response indicating update status or error message
   * @throws {Error} When email update fails
   */
  public updateEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const id = parseInt(c.req.param('id'));
      const body: UpdateBulkEmailBody = await c.req.json();
      await this.service.updateEmail(id, body);
      return c.json({ message: 'Email updated successfully' });
    } catch (error) {
      console.error('Error updating email:', error);
      return c.json({ error: 'Failed to update email' }, 500);
    }
  };

  /**
   * Deletes an email template from the system
   * @param {Context} c - The Hono context containing email ID
   * @returns {Promise<Response>} Response indicating deletion status or error message
   * @throws {Error} When email deletion fails
   */
  public deleteEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const id = parseInt(c.req.param('id'));
      await this.service.deleteEmail(id);
      return c.json({ message: 'Email deleted successfully' });
    } catch (error) {
      console.error('Error deleting email:', error);
      return c.json({ error: 'Failed to delete email' }, 500);
    }
  };

  /**
   * Toggles an email template from the system
   * @param {Context} c - The Hono context containing email ID
   * @returns {Promise<Response>} Response indicating deletion status or error message
   * @throws {Error} When email toggling fails
   */
  public toggleBulkEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: ToggleBulkEmailBody = await c.req.json();
      const { id, action } = body;
      await this.service.toggleBulkEmail(id, action);
      return c.json({ message: 'Email toggled successfully' });
    } catch (error) {
      console.error('Error toggling email:', error);
    }
  };
}
