import { encrypt } from '../lib/encryption.ts';
import env from '../lib/env.ts';
import { logger } from '../lib/logger.ts';
import type { UserRepository } from '../repository/user.ts';
import type { User } from '../schema/schema.ts';
import { sendTransactionalEmail } from '../task/email-processor.ts';
import type { EventService } from './event.ts';
import type { LeadService } from './lead.ts';
import type { MembershipService } from './membership.ts';
import type { StripeService } from './stripe.ts';

/**
 * Service class for managing users, including creation, authentication, and profile management
 */
export class UserService {
  private repo: UserRepository;
  private stripeService: StripeService;
  private membershipService: MembershipService;
  private eventService: EventService;
  private leadService: LeadService;

  /**
   * Creates an instance of UserService
   * @param {UserRepository} userRepository - Repository for user operations
   * @param {StripeService} stripeService - Service for Stripe operations
   * @param {MembershipService} membershipService - Service for membership operations
   * @param {EventService} eventService - Service for event operations
   * @param {LeadService} leadService - Service for lead operations
   */
  constructor(
    userRepository: UserRepository,
    stripeService: StripeService,
    membershipService: MembershipService,
    eventService: EventService,
    leadService: LeadService,
  ) {
    this.repo = userRepository;
    this.stripeService = stripeService;
    this.membershipService = membershipService;
    this.eventService = eventService;
    this.leadService = leadService;
    this.create = this.create.bind(this);
    this.findByEmail = this.findByEmail.bind(this);
  }

  /**
   * Creates a new user
   * @param {string} name - User's name
   * @param {string} email - User's email address
   * @param {string} password - User's password (will be encrypted)
   * @param {'master'|'owner'|'host'} role - User's role
   * @param {string} phone - User's phone number
   * @param {Partial<User>} [additionalFields={}] - Optional additional user fields
   * @returns {Promise<User>} Created user
   * @throws {Error} When user creation fails
   */
  public async create(
    name: string,
    email: string,
    password: string,
    role: 'master' | 'owner' | 'host',
    phone: string,
    additionalFields: Partial<User> = {},
  ) {
    try {
      // Create Stripe customer first if not provided
      const stripeCustomerId =
        additionalFields.stripe_customer_id || (await this.stripeService.createCustomer(email)).id;

      const hashedPassword = encrypt(password);

      // Create user with all fields
      const user = await this.repo.create({
        name,
        email,
        password: hashedPassword,
        role,
        phone,
        stripe_customer_id: stripeCustomerId,
        auth_provider: 'local',
        ...additionalFields,
      });

      return user;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Finds a user by their email address
   * @param {string} email - Email address to search for
   * @returns {Promise<User|undefined>} The user if found
   */
  public async findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  /**
   * Gets a user's dashboard
   * @param {number} id - ID of the user
   * @returns {Promise<Dashboard>} The dashboard
   */
  public async getDashboard(id: number) {
    const [dashboard, events] = await Promise.all([
      this.repo.getDashboard(id),
      this.eventService.getEventsByUser(id),
    ]);
    const now = Math.floor(Date.now() / 1000);

    // Collect all unique membership date IDs across returned events
    const allDateIds = new Set<number>();
    for (const item of events.events) {
      const ids = item.memberships?.flatMap((m) => m.dates?.map((d) => d.id) || []) || [];
      ids.forEach((did) => allDateIds.add(did));
    }

    // Query lead counts per date_id once via LeadService
    const countsByDateId = new Map<number, number>();
    if (allDateIds.size > 0) {
      const rows = await this.leadService.countByDateIds(Array.from(allDateIds));
      rows.forEach((r) => countsByDateId.set(Number(r.date_id), Number((r as any).count)));
    }

    const mapped = events.events.map((item) => {
      const { status, id, event_name, event_type } = item.event;
      const rawDates = item.memberships?.flatMap((m) => m.dates || []) || [];
      const dates = rawDates.map((d) => ({
        id: d.id,
        date: d.date,
        lead_count: countsByDateId.get(d.id) || 0,
        membership_name: item.memberships?.find((m) => m.dates?.some((md) => md.id === d.id))?.name,
      }));
      const membership_name = item.memberships?.map((m) => m.name) || [];
      const upcoming_dates = dates.filter((d) => parseInt(d.date, 10) > now);

      return {
        id,
        event_name,
        event_type,
        dates,
        upcoming_dates,
        status,
        membership_name,
      };
    });

    //spread the mapped events into the dashboard.events
    const dashboardEvents = {
      events: dashboard.events_stats.events.map((ev) => {
        const match = mapped.find((e) => e.id === ev.event_id);
        return {
          ...ev,
          ...match,
        };
      }),
      totals: dashboard.events_stats.totals,
    };

    // Build a flattened, one-row-per-date view for frontend consumption
    const eventsFlat = dashboardEvents.events
      .flatMap((ev) => {
        const { dates } = ev;
        const list = dates && dates.length > 0 ? dates : [];
        return list.map((d) => ({
          ...ev,
          dateItem: d,
        }));
      })
      .sort((a, b) => Number(b.dateItem?.date) - Number(a.dateItem?.date));

    const upcomingDates = mapped.flatMap((e) => e.upcoming_dates);
    const totalDates = mapped.flatMap((e) => e.dates);
    const cancelledDates = mapped.flatMap((e) => e.status === 'cancelled');

    const event_counts = {
      upcoming: upcomingDates.length,
      total: totalDates.length,
      cancelled: cancelledDates.length,
    };

    return {
      ...dashboard,
      events: {
        ...dashboardEvents,
        events_flat: eventsFlat,
      },
      totalEvents: events.total,
      event_counts,
    };
  }

  /**
   * Gets all events statistics for a user
   * @param {number} id - ID of the user
   * @returns {Promise<LiveEventsStats>} The live events statistics
   */
  public async getAllEventsStats(id: number) {
    return this.repo.getAllEventsStats(id);
  }

  /**
   * Finds a user by their ID
   * @param {number} id - ID of the user
   * @returns {Promise<User|undefined>} The user if found
   */
  public async find(id: number) {
    return this.repo.find(id);
  }

  /**
   * Updates a user's information
   * @param {number} id - ID of the user to update
   * @param {Partial<User>} user - Updated user information
   * @returns {Promise<User>} The updated user
   */
  public async update(id: number, user: Partial<User>) {
    return this.repo.update(id, user);
  }

  /**
   * Updates a user's profile image
   * @param {number} id - ID of the user to update
   * @param {string} imageUrl - URL of the new profile image
   * @returns {Promise<User>} The updated user
   */
  public async updateProfileImage(id: number, imageUrl: string) {
    return this.repo.update(id, {
      profile_picture: imageUrl,
    });
  }

  /**
   * Deletes a user
   * @param {number} id - ID of the user to delete
   * @returns {Promise<void>}
   */
  public async delete(id: number) {
    return this.repo.delete(id);
  }

  /**
   * Sends a welcome email to a newly registered user
   * @param {string} email - Email address of the user
   * @returns {Promise<void>}
   * @throws {Error} When user is not found or email sending fails
   */
  public async sendWelcomeEmail(email: string) {
    try {
      const user = await this.findByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      await sendTransactionalEmail(user.email, user.name, 12, {
        subject: `Welcome to ${env.BRAND_NAME}`,
        title: `Welcome to ${env.BRAND_NAME}`,
        subtitle: 'Your subscription is now active',
        body: `Thank you for subscribing to ${env.BRAND_NAME}. Your subscription is now active and you can start using all our features.`,
        buttonText: 'Ok, got it',
        buttonLink: `${env.FRONTEND_URL}`,
      });

      logger.info(`Welcome email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      throw error;
    }
  }
}
