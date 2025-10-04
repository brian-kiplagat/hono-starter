import dayjs from 'dayjs';
import type { Context } from 'hono';

import env from '../../lib/env.ts';
import type { NewEmail } from '../../schema/schema.ts';
import { BusinessService } from '../../service/business.ts';
import { EmailService } from '../../service/email.ts';
import { EventService } from '../../service/event.ts';
import { LeadService } from '../../service/lead.ts';
import { MembershipService } from '../../service/membership.ts';
import { UserService } from '../../service/user.ts';
import { formatDateToLocale, formatMinutes } from '../../util/string.ts';
import type {
  BulkEmailBody,
  CreateBulkEmailBody,
  ToggleBulkEmailBody,
  UpdateBulkEmailBody,
  UpdateFollowUpEmailBody,
} from '../validator/email.ts';
import { ERRORS, serveBadRequest } from './resp/error.ts';

export class EmailController {
  private service: EmailService;
  private userService: UserService;
  private leadService: LeadService;
  private businessService: BusinessService;
  private eventService: EventService;
  private membershipService: MembershipService;
  constructor(
    service: EmailService,
    userService: UserService,
    leadService: LeadService,
    businessService: BusinessService,
    eventService: EventService,
    membershipService: MembershipService,
  ) {
    this.service = service;
    this.userService = userService;
    this.leadService = leadService;
    this.businessService = businessService;
    this.eventService = eventService;
    this.membershipService = membershipService;
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
   * Creates a new email template
   * @param {Context} c - The Hono context containing email details
   * @returns {Promise<Response>} Response containing created email ID or error message
   * @throws {Error} When email creation fails or validation fails
   */
  public createBulkEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      if (user.role === 'owner' || user.role === 'master') {
        return serveBadRequest(c, ERRORS.ADMINS_NOT_ALLOWED);
      }
      const business = await this.businessService.getBusinessByUserId(user.id);
      if (!business) {
        return serveBadRequest(c, ERRORS.BUSINESS_NOT_FOUND);
      }
      const body: BulkEmailBody = await c.req.json();
      const { type, recipients, filterType, selectedMembership } = body;
      // Create base email data
      const baseEmailData: NewEmail = {
        email: 'email@example.com',
        subject: body.subject,
        title: body.title,
        subtitle: body.subtitle,
        body: body.body,
        button_text: body.button_text,
        button_link: body.button_link,
        host_id: user.id,
      };

      const emailsToAdd: NewEmail[] = [];

      if (type === 'event') {
        if (!recipients || recipients.length === 0) {
          return serveBadRequest(c, ERRORS.PROVIDE_SOME_LEADS_OR_TAGS);
        }

        // If no membership selected, return error
        if (!selectedMembership) {
          return serveBadRequest(c, ERRORS.PROVIDE_SOME_LEADS_OR_TAGS);
        }

        let uniqueEmails: string[] = [];
        if (filterType === 'everyone') {
          // Get unique lead emails for all events with selected membership
          uniqueEmails = await this.leadService.findUniqueLeadEmails(selectedMembership, {
            eventIds: recipients,
          });
        } else if (filterType === 'attended') {
          uniqueEmails = (
            await this.leadService.findLeadsByAttendedStatus(selectedMembership, true, recipients)
          )
            .map((lead) => lead.email)
            .filter((email): email is string => email !== null);
        } else if (filterType === 'notAttended') {
          uniqueEmails = (
            await this.leadService.findLeadsByAttendedStatus(selectedMembership, false, recipients)
          )
            .map((lead) => lead.email)
            .filter((email): email is string => email !== null);
        }
        // Create emails for unique leads
        uniqueEmails.forEach((email) => {
          emailsToAdd.push({
            ...baseEmailData,
            email,
          });
        });
      } else if (type === 'name') {
        if (!recipients || recipients.length === 0) {
          return serveBadRequest(c, ERRORS.PROVIDE_SOME_LEADS_OR_TAGS);
        }
        // Get unique lead emails for all leads
        // For name type, we don't filter by membership, so pass 0 as default
        const uniqueEmails = await this.leadService.findUniqueLeadEmails(0, {
          leadIds: recipients,
        });

        // Create emails for unique leads
        uniqueEmails.forEach((email) => {
          emailsToAdd.push({
            ...baseEmailData,
            email,
          });
        });
      } else if (type === 'tag') {
        if (!recipients || recipients.length === 0) {
          return serveBadRequest(c, ERRORS.PROVIDE_SOME_LEADS_OR_TAGS);
        }
        // Get the emails of the leads with the tag
        const uniqueEmails = await this.leadService.findUniqueLeadEmailsByTagIds({
          tagIds: recipients,
        });
        // Create emails for unique leads
        uniqueEmails.forEach((email) => {
          emailsToAdd.push({
            ...baseEmailData,
            email,
          });
        });
      }

      // Check if we have any emails to send
      if (emailsToAdd.length === 0) {
        return c.json(
          {
            error:
              'We could not find any recipients for the selected criteria. Please refine your filters and try again.',
          },
          400,
        );
      }

      // Bulk add the emails to the database
      const { count, emails } = await this.service.bulkAddEmails(emailsToAdd, user, business);
      return c.json({ count, emails }, 201);
    } catch (error) {
      console.error('Error creating email:', error);
      return c.json({ error: 'Failed to create email' }, 500);
    }
  };

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
   * Creates a follow up email template
   * @param {Context} c - The Hono context containing updated email information
   * @returns {Promise<Response>} Response indicating update status or error message
   * @throws {Error} When email update fails
   */
  public createFollowUpEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const body: CreateBulkEmailBody = await c.req.json();
      //first check if the email timeline already exists
      const existingEmail = await this.service.getEnabledFollowUpEmailByTimeline(
        user.id,
        body.timeline,
        true,
      );
      if (existingEmail) {
        return serveBadRequest(c, ERRORS.EMAIL_TIMELINE_ALREADY_EXISTS);
      }
      await this.service.createFollowUpEmail({ ...body, user_id: user.id, enabled: true });
      return c.json({ message: 'Follow up email created successfully' });
    } catch (error) {
      console.error('Error creating follow up email:', error);
      return c.json({ error: 'Failed to create follow up email' }, 500);
    }
  };

  /**
   * Updates a follow up email template
   * @param {Context} c - The Hono context containing updated email information
   * @returns {Promise<Response>} Response indicating update status or error message
   * @throws {Error} When follow up email update fails
   */
  public updateFollowUpEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const id = parseInt(c.req.param('id'));
      const body: UpdateFollowUpEmailBody = await c.req.json();

      // If timeline is being updated, check if another email with that timeline exists
      if (body.timeline !== undefined) {
        const existingEmail = await this.service.getEnabledFollowUpEmailByTimeline(
          user.id,
          body.timeline,
          true,
        );
        if (existingEmail && existingEmail.id !== id) {
          return serveBadRequest(c, ERRORS.EMAIL_TIMELINE_ALREADY_EXISTS);
        }
      }

      await this.service.updateFollowUpEmail(id, body);
      return c.json({ message: 'Follow up email updated successfully' });
    } catch (error) {
      console.error('Error updating follow up email:', error);
      return c.json({ error: 'Failed to update follow up email' }, 500);
    }
  };

  /** Get all follow up emails
   * @param {Context} c - The Hono context containing user information
   * @returns {Promise<Response>} Response containing list of follow up emails or error message
   * @throws {Error} When follow up email retrieval fails
   */
  public getFollowUpEmails = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const followUpEmails = await this.service.getFollowUpEmails(user.id);
      return c.json(followUpEmails);
    } catch (error) {
      console.error('Error getting follow up emails:', error);
      return c.json({ error: 'Failed to get follow up emails' }, 500);
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
   * Deletes an follow up email template from the system
   * @param {Context} c - The Hono context containing email ID
   * @returns {Promise<Response>} Response indicating deletion status or error message
   * @throws {Error} When email deletion fails
   */
  public deleteFollowUpEmail = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }
      const id = parseInt(c.req.param('id'));
      await this.service.deleteFollowUpEmail(id);
      return c.json({ message: 'Follow up email deleted successfully' });
    } catch (error) {
      console.error('Error deleting follow up email:', error);
      return c.json({ error: 'Failed to delete follow up email' }, 500);
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
  /**
   * Trigger email_event_countdown
   * Sent 3 days before the event
   * This is triggered via cron job
   */
  public triggerEmailEventCountdown = async (c: Context) => {
    try {
      const leads = await this.leadService.findLeadsForCountdownEmails(false);
      const sentEmails: Array<{ email: string; leadId: number; eventId: number }> = [];
      const skippedEmails: Array<{
        email: string;
        leadId: number;
        eventId: number;
        reason: string;
      }> = [];
      const emailsToSend: Array<{
        email: string;
        name: string;
        params: Record<string, string>;
        templateId: number;
      }> = [];

      // Process leads that need countdown emails (3-5 days before event)
      for (const lead of leads) {
        if (!lead.email || !lead.name || !lead.date_id) {
          skippedEmails.push({
            email: lead.email || 'No email',
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: !lead.email ? 'No email address' : !lead.name ? 'No name' : 'No event dates',
          });
          continue;
        }

        //check if host
        const host = await this.userService.find(lead.host_id);
        if (!host) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Host not found',
          });
          continue;
        }

        //get the business under the host
        const business = await this.businessService.getBusinessByUserId(host.id);
        if (!business) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Business not found for host',
          });
          continue;
        }

        //get the event
        const event = await this.eventService.getEvent(Number(lead.event_id));
        if (!event) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Event not found',
          });
          continue;
        }

        if (!lead.membership_id) {
          //if no membership level, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership level not found',
          });
          continue;
        }

        //get membership dates
        const membershipDates = await this.membershipService.getMembershipDates(lead.membership_id);
        if (!membershipDates) {
          //if no membership dates, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership dates not found',
          });
          continue;
        }

        // Check if any event is 3 days away
        const today = dayjs();
        let emailSent = false;
        const dateTimestamp = membershipDates[0];
        const eventDate = dayjs.unix(Number(dateTimestamp.date));
        const hoursUntil = eventDate.diff(today, 'hour');

        const formatter = new Intl.ListFormat('en', {
          style: 'long',
          type: 'conjunction',
        });
        const formattedDates = membershipDates.map((date) =>
          formatDateToLocale(dayjs(Number(date.date) * 1000).toDate(), 'Europe/London'),
        );
        const formattedEventDate = formatter.format(formattedDates);

        if (hoursUntil === 72) {
          const buttonLink =
            event?.event_type === 'live_venue'
              ? `${env.FRONTEND_URL}/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success`
              : event?.event_type === 'live_video_call'
                ? `${event?.live_video_url}`
                : `${env.FRONTEND_URL}/stream?token=${lead.token}&email=${lead.email}&code=${lead.event_id}`;

          const params = {
            username: String(lead.name),
            eventname: event.event_name || 'Event',
            eventdate: formattedEventDate.split(',').slice(0, -1).join(',').trim(),
            eventtime: formattedEventDate.split(',').pop()?.trim() || '',
            eventlink: buttonLink,
            busname: business.name || '',
            busemail: business.email || '',
            busaddress: business.address || '',
            duration: formatMinutes(event.duration || 0),
            hostname: host.name || 'Event Host',
            hostemail: host.email || '',
            ticketid: `#${lead.id}-${lead.token}`,
            landingpage: event?.landing_page_url || 'No link available currently',
          };

          emailsToSend.push({
            email: String(lead.email),
            name: String(lead.name),
            params: params,
            templateId: 5, // Template ID for countdown emails
          });

          // Update lead to mark countdown email as sent
          await this.leadService.update(lead.id, {
            email_event_countdown: true,
          });

          // Add to sent emails array
          sentEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
          });

          emailSent = true;
          break; // Only send one countdown email per lead
        }

        // If no email was sent, track the reason
        if (!emailSent) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Event not exactly 3 days away',
          });
        }
      }

      // Send all emails in a single batch
      if (emailsToSend.length > 0) {
        await this.service.bulkSendFollowUpEmails(emailsToSend);
      }

      return c.json({
        message: 'Countdown emails processed successfully',
        sentEmails: sentEmails,
        totalSent: sentEmails.length,
        skippedEmails: skippedEmails,
        totalSkipped: skippedEmails.length,
        totalRecords: leads.length,
      });
    } catch (error) {
      console.error('Error triggering email_event_countdown:', error);
      return c.json({ error: 'Failed to trigger email_event_countdown' }, 500);
    }
  };

  /**
   * Trigger email_final_reminder
   * Sent 24 hours before the event
   * This is triggered via cron job
   */
  public triggerEmailFinalReminder = async (c: Context) => {
    try {
      const leads = await this.leadService.findLeadsForFinalReminderEmails(false);
      const sentEmails: Array<{ email: string; leadId: number; eventId: number }> = [];
      const skippedEmails: Array<{
        email: string;
        leadId: number;
        eventId: number;
        reason: string;
      }> = [];
      const emailsToSend: Array<{
        email: string;
        name: string;
        params: Record<string, string>;
        templateId: number;
      }> = [];

      for (const lead of leads) {
        if (!lead.email || !lead.name || !lead.date_id) {
          skippedEmails.push({
            email: lead.email || 'No email',
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: !lead.email ? 'No email address' : !lead.name ? 'No name' : 'No event dates',
          });
          continue;
        }

        //check if host
        const host = await this.userService.find(lead.host_id);
        if (!host) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Host not found',
          });
          continue;
        }

        //get the business under the host
        const business = await this.businessService.getBusinessByUserId(host.id);
        if (!business) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Business not found for host',
          });
          continue;
        }

        //get the event
        const event = await this.eventService.getEvent(Number(lead.event_id));
        if (!event) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Event not found',
          });
          continue;
        }

        if (!lead.membership_id) {
          //if no membership level, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership level not found',
          });
          continue;
        }

        //get membership dates
        const membershipDates = await this.membershipService.getMembershipDates(lead.membership_id);
        if (!membershipDates) {
          //if no membership dates, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership dates not found',
          });
          continue;
        }

        const today = dayjs();
        let emailSent = false;

        const dateTimestamp = membershipDates[0];
        const eventDate = dayjs.unix(Number(dateTimestamp.date));
        const hoursUntil = eventDate.diff(today, 'hour');

        const formatter = new Intl.ListFormat('en', {
          style: 'long',
          type: 'conjunction',
        });
        const formattedDates = membershipDates.map((date) =>
          formatDateToLocale(dayjs(Number(date.date) * 1000).toDate(), 'Europe/London'),
        );
        const formattedEventDate = formatter.format(formattedDates);

        if (hoursUntil === 24) {
          const buttonLink =
            event?.event_type === 'live_venue'
              ? `${env.FRONTEND_URL}/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success`
              : event?.event_type === 'live_video_call'
                ? `${event?.live_video_url}`
                : `${env.FRONTEND_URL}/stream?token=${lead.token}&email=${lead.email}&code=${lead.event_id}`;
          const params = {
            username: String(lead.name),
            eventname: event.event_name || 'Event',
            eventdate: formattedEventDate.split(',').slice(0, -1).join(',').trim(),
            eventtime: formattedEventDate.split(',').pop()?.trim() || '',
            eventlink: buttonLink,
            busname: business.name || '',
            busemail: business.email || '',
            busaddress: business.address || '',
            duration: formatMinutes(event.duration || 0),
            hostname: host.name || 'Event Host',
            hostemail: host.email || '',
            ticketid: `#${lead.id}-${lead.token}`,
            landingpage: event?.landing_page_url || 'No link available currently',
          };

          emailsToSend.push({
            email: String(lead.email),
            name: String(lead.name),
            params: params,
            templateId: 6, // Template ID for final reminder
          });

          // Update lead to mark final reminder email as sent
          await this.leadService.update(lead.id, {
            email_final_reminder: true,
          });

          // Add to sent emails array
          sentEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
          });

          emailSent = true;
          break;
        }

        // If no email was sent, track the reason
        if (!emailSent) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Event not exactly 1 day away',
          });
        }
      }

      // Send all emails in a single batch
      if (emailsToSend.length > 0) {
        await this.service.bulkSendFollowUpEmails(emailsToSend);
      }

      return c.json({
        message: 'Final reminder emails processed successfully',
        sentEmails: sentEmails,
        totalSent: sentEmails.length,
        skippedEmails: skippedEmails,
        totalSkipped: skippedEmails.length,
        totalRecords: leads.length,
      });
    } catch (error) {
      console.error('Error triggering email_final_reminder:', error);
      return c.json({ error: 'Failed to trigger email_final_reminder' }, 500);
    }
  };

  /**
   * Trigger email_event_day_reminder
   * Sent 1 hour before event starts
   * This is triggered via cron job
   */
  public triggerEmailEventDayReminder = async (c: Context) => {
    try {
      const leads = await this.leadService.findLeadsForEventDayEmails(false);
      const sentEmails: Array<{ email: string; leadId: number; eventId: number }> = [];
      const skippedEmails: Array<{
        email: string;
        leadId: number;
        eventId: number;
        reason: string;
      }> = [];
      const emailsToSend: Array<{
        email: string;
        name: string;
        params: Record<string, string>;
        templateId: number;
      }> = [];

      for (const lead of leads) {
        if (!lead.email || !lead.name || !lead.date_id) {
          skippedEmails.push({
            email: lead.email || 'No email',
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: !lead.email ? 'No email address' : !lead.name ? 'No name' : 'No event dates',
          });
          continue;
        }

        //check if host
        const host = await this.userService.find(lead.host_id);
        if (!host) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Host not found',
          });
          continue;
        }

        //get the business under the host
        const business = await this.businessService.getBusinessByUserId(host.id);
        if (!business) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Business not found for host',
          });
          continue;
        }

        //get the event
        const event = await this.eventService.getEvent(Number(lead.event_id));
        if (!event) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Event not found',
          });
          continue;
        }

        if (!lead.membership_id) {
          //if no membership level, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership level not found',
          });
          continue;
        }

        //get membership dates
        const membershipDates = await this.membershipService.getMembershipDates(lead.membership_id);
        if (!membershipDates) {
          //if no membership dates, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership dates not found',
          });
          continue;
        }

        let emailSent = false;
        const today = dayjs();
        const dateTimestamp = membershipDates[0];
        const eventDate = dayjs.unix(Number(dateTimestamp.date));
        const minutesUntil = eventDate.diff(today, 'minute');

        const formatter = new Intl.ListFormat('en', {
          style: 'long',
          type: 'conjunction',
        });
        const formattedDates = membershipDates.map((date) =>
          formatDateToLocale(dayjs(Number(date.date) * 1000).toDate(), 'Europe/London'),
        );
        const formattedEventDate = formatter.format(formattedDates);

        if (minutesUntil <= 60 && minutesUntil >= 0) {
          const buttonLink =
            event?.event_type === 'live_venue'
              ? `${env.FRONTEND_URL}/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success`
              : event?.event_type === 'live_video_call'
                ? `${event?.live_video_url}`
                : `${env.FRONTEND_URL}/stream?token=${lead.token}&email=${lead.email}&code=${lead.event_id}`;
          const params = {
            username: String(lead.name),
            eventname: event.event_name || 'Event',
            eventdate: formattedEventDate.split(',').slice(0, -1).join(',').trim(),
            eventtime: formattedEventDate.split(',').pop()?.trim() || '',
            eventlink: buttonLink,
            busname: business.name || '',
            busemail: business.email || '',
            duration: formatMinutes(event.duration || 0),
            busaddress: business.address || '',
            hostname: host.name || 'Event Host',
            hostemail: host.email || '',
            ticketid: `#${lead.id}-${lead.token}`,
            landingpage: event?.landing_page_url || 'No link available currently',
          };

          emailsToSend.push({
            email: String(lead.email),
            name: String(lead.name),
            params: params,
            templateId: 7, // Template ID for event day reminder
          });

          // Update lead to mark event day reminder email as sent
          await this.leadService.update(lead.id, {
            email_event_day_reminder: true,
          });

          // Add to sent emails array
          sentEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
          });

          emailSent = true;
          break;
        }

        // If no email was sent, track the reason
        if (!emailSent) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Event not within 1 hour',
          });
        }
      }

      // Send all emails in a single batch
      if (emailsToSend.length > 0) {
        await this.service.bulkSendFollowUpEmails(emailsToSend);
      }

      return c.json({
        message: 'Event day reminder emails processed successfully',
        sentEmails: sentEmails,
        totalSent: sentEmails.length,
        skippedEmails: skippedEmails,
        totalSkipped: skippedEmails.length,
        totalRecords: leads.length,
      });
    } catch (error) {
      console.error('Error triggering email_event_day_reminder:', error);
      return c.json({ error: 'Failed to trigger email_event_day_reminder' }, 500);
    }
  };

  /**
   * Trigger email_thank_you_follow_up
   * This is triggered via cron job
   * Now supports custom timeline follow-up emails
   */
  public triggerEmailThankYouFollowUp = async (c: Context) => {
    try {
      const leads = await this.leadService.findLeadsForThankYouEmails(false);
      const sentEmails: Array<{
        email: string;
        leadId: number;
        eventId: number;
        followUpId?: number;
        timeline?: number;
      }> = [];
      const skippedEmails: Array<{
        email: string;
        leadId: number;
        eventId: number;
        reason: string;
      }> = [];
      const emailsToSend: Array<{
        email: string;
        name: string;
        params: Record<string, string>;
        templateId: number;
      }> = [];

      for (const lead of leads) {
        if (!lead.email || !lead.name || !lead.date_id) {
          skippedEmails.push({
            email: lead.email || 'No email',
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: !lead.email
              ? 'No email address'
              : !lead.name
                ? 'No name'
                : 'No event dates, has the lead reserved attendance?',
          });
          continue;
        }

        //check if host
        const host = await this.userService.find(lead.host_id);
        if (!host) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Host not found',
          });
          continue;
        }

        //get the business under the host
        const business = await this.businessService.getBusinessByUserId(host.id);
        if (!business) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Business not found for host',
          });
          continue;
        }

        //get the event
        const event = await this.eventService.getEvent(Number(lead.event_id));
        if (!event) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Event not found',
          });
          continue;
        }

        if (!lead.membership_id) {
          //if no membership level, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership level not found',
          });
          continue;
        }

        //get membership dates
        const membershipDates = await this.membershipService.getMembershipDates(lead.membership_id);
        if (!membershipDates) {
          //if no membership dates, skip
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: 'Membership dates not found',
          });
          continue;
        }

        const today = dayjs();
        let emailSent = false;

        // Since membership has only one date, get the single date
        const dateTimestamp = membershipDates[0];
        const eventDate = dayjs.unix(Number(dateTimestamp.date));
        const daysSince = today.diff(eventDate, 'day');

        // Optimize: Direct lookup for timeline instead of loading all follow-up emails
        const matchingFollowUpEmail = await this.service.getEnabledFollowUpEmailByTimeline(
          host.id,
          daysSince,
          true,
        );

        if (!matchingFollowUpEmail) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: `No custom follow-up email configured for ${daysSince} day(s) timeline`,
          });
          continue;
        }

        // Cache shared formatting and button links to avoid recalculation
        const formatter = new Intl.ListFormat('en', {
          style: 'long',
          type: 'conjunction',
        });
        const formattedDates = membershipDates.map((date) =>
          formatDateToLocale(dayjs(Number(date.date) * 1000).toDate(), 'Europe/London'),
        );
        const formattedEventDate = formatter.format(formattedDates);

        const buttonLink =
          event?.event_type === 'live_venue'
            ? `${env.FRONTEND_URL}/thank-you?token=${lead.token}&email=${lead.email}&code=${lead.event_id}&action=success`
            : event?.event_type === 'live_video_call'
              ? `${event?.live_video_url}`
              : `${env.FRONTEND_URL}/stream?token=${lead.token}&email=${lead.email}&code=${lead.event_id}`;

        // Check if this lead's status matches the follow-up email target audience
        const isAllowed =
          Array.isArray(matchingFollowUpEmail.follow_up_who_gets_it) &&
          matchingFollowUpEmail.follow_up_who_gets_it.includes(lead.lead_status);

        if (!isAllowed) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: `Lead status ${lead.lead_status} excluded by follow_up_who_gets_it for template ${matchingFollowUpEmail.title}`,
          });
          // No email sent for this lead
        } else {
          // Proceed with sending the custom follow-up email
          const customBody = matchingFollowUpEmail.content || '';
          const username = String(lead.name);
          const eventname = event.event_name || 'Event';
          const eventdate = formattedEventDate.split(',').slice(0, -1).join(',').trim();
          const eventtime = formattedEventDate.split(',').pop()?.trim() || '';
          const eventlink = buttonLink;
          const busname = business.name || '';
          const busemail = business.email || '';
          const duration = formatMinutes(event.duration || 0);
          const busaddress = business.address || '';
          const hostname = host.name || 'Event Host';
          const hostemail = host.email || '';
          const subject =
            matchingFollowUpEmail.title ||
            `We hope you were able to join us at "${event.event_name}"`;
          const ticketid = `#${lead.id}-${lead.token}`;
          const landingpage = event?.landing_page_url || 'No link available currently';
          const custombody = matchingFollowUpEmail.content || '';

          const params = {
            username,
            eventname,
            eventdate,
            eventtime,
            eventlink,
            busname,
            busemail,
            duration,
            busaddress,
            hostname,
            hostemail,
            subject,
            ticketid,
            landingpage,
            custombody,
          };

          // Replace placeholders like [username], [eventname], etc.
          const processedBody = customBody.replace(/\[(\w+)\]/g, (_, key) => {
            const typedKey = key as keyof typeof params;
            if (typedKey in params && params[typedKey] !== undefined && params[typedKey] !== null) {
              return String(params[typedKey]);
            }
            return `[${key}]`;
          });

          // Replace the custombody in params with the processed version
          const finalParams = {
            ...params,
            custombody: processedBody,
          };

          emailsToSend.push({
            email: String(lead.email),
            name: String(lead.name),
            params: finalParams,
            templateId: 11, // Custom template ID for follow-up emails
          });

          // Update lead to mark thank you follow-up email as sent
          await this.leadService.update(lead.id, {
            email_thank_you_follow_up: true,
          });

          // Add to sent emails array
          sentEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            followUpId: matchingFollowUpEmail.id,
            timeline: matchingFollowUpEmail.timeline,
          });

          emailSent = true;
        }

        // If no email was sent, track the reason
        if (!emailSent) {
          skippedEmails.push({
            email: String(lead.email),
            leadId: lead.id,
            eventId: Number(lead.event_id),
            reason: `No matching timeline found for ${daysSince} days since event`,
          });
        }
      }

      // Send all emails in a single batch
      if (emailsToSend.length > 0) {
        await this.service.bulkSendFollowUpEmails(emailsToSend);
      }

      return c.json({
        message: 'Thank you follow-up emails processed successfully with custom timeline support',
        sentEmails: sentEmails,
        totalSent: sentEmails.length,
        skippedEmails: skippedEmails,
        totalSkipped: skippedEmails.length,
        totalRecords: leads.length,
        summary: {
          processedAt: new Date().toISOString(),
          customFollowUpEmailsUsed: sentEmails.filter((e) => e.followUpId).length,
          timelinesUsed: [...new Set(sentEmails.map((e) => e.timeline))],
        },
      });
    } catch (error) {
      console.error('Error triggering email_thank_you_follow_up:', error);
      return c.json({ error: 'Failed to trigger email_thank_you_follow_up' }, 500);
    }
  };
}
