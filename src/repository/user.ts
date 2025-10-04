import { and, desc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

import { db } from '../lib/database.ts';
import { type NewUser, type User, userSchema } from '../schema/schema.js';
import {
  bookings,
  callbackSchema,
  contactSchema,
  courseSchema,
  eventSchema,
  leadSchema,
  paymentSchema,
  podcastSchema,
  teamInvitationSchema,
  teamMemberSchema,
} from '../schema/schema.js';
import { memberships } from '../schema/schema.js';

export class UserRepository {
  public async create(user: NewUser) {
    return db.insert(userSchema).values(user).$returningId();
  }

  public async find(id: number) {
    return db.query.userSchema.findFirst({
      where: eq(userSchema.id, id),
      with: {
        business: true,
      },
    });
  }

  public async findByEmail(email: string) {
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.email, email),
      with: {
        business: true,
      },
    });
    if (user && !user.auth_provider) {
      user.auth_provider = 'local';
    }
    return user;
  }

  public async update(id: number, user: Partial<User>) {
    return db.update(userSchema).set(user).where(eq(userSchema.id, id));
  }

  public async delete(id: number) {
    return db.delete(userSchema).where(eq(userSchema.id, id));
  }

  public async getDashboard(id: number) {
    // Get user profile with business info
    const user = await db.query.userSchema.findFirst({
      where: eq(userSchema.id, id),
      with: {
        business: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get all metrics in a single query using subqueries
    const [metrics] = await db
      .select({
        // Content counts
        total_events: sql<number>`(SELECT COUNT(*) FROM ${eventSchema} WHERE ${eventSchema.host_id} = ${id})`,
        total_podcasts: sql<number>`(SELECT COUNT(*) FROM ${podcastSchema} WHERE ${podcastSchema.host_id} = ${id})`,
        total_courses: sql<number>`(SELECT COUNT(*) FROM ${courseSchema} WHERE ${courseSchema.host_id} = ${id})`,
        total_leads: sql<number>`(SELECT COUNT(*) FROM ${leadSchema} WHERE ${leadSchema.host_id} = ${id})`,
        total_contacts: sql<number>`(SELECT COUNT(*) FROM ${contactSchema} WHERE ${contactSchema.id} = ${id})`,

        // Revenue metrics
        total_revenue: sql<number>`(SELECT COALESCE(SUM(amount), 0) FROM ${paymentSchema} WHERE ${paymentSchema.beneficiary_id} = ${id} AND ${paymentSchema.status} = 'succeeded')`,
        successful_payments: sql<number>`(SELECT COUNT(*) FROM ${paymentSchema} WHERE ${paymentSchema.beneficiary_id} = ${id} AND ${paymentSchema.status} = 'succeeded')`,
        failed_payments: sql<number>`(SELECT COUNT(*) FROM ${paymentSchema} WHERE ${paymentSchema.beneficiary_id} = ${id} AND ${paymentSchema.status} = 'failed')`,
        active_memberships: sql<number>`(SELECT COUNT(*) FROM ${memberships} WHERE ${memberships.user_id} = ${id})`,

        // Engagement metrics
        active_bookings: sql<number>`(SELECT COUNT(*) FROM ${bookings} WHERE ${bookings.host_id} = ${id})`,
        pending_callbacks: sql<number>`(SELECT COUNT(*) FROM ${callbackSchema} WHERE ${callbackSchema.host_id} = ${id} AND ${callbackSchema.status} = 'uncalled')`,
        team_members: sql<number>`(SELECT COUNT(*) FROM ${teamMemberSchema} WHERE ${teamMemberSchema.team_id} = ${id})`,
        pending_invitations: sql<number>`(SELECT COUNT(*) FROM ${teamInvitationSchema} WHERE ${teamInvitationSchema.team_id} = ${id} AND ${teamInvitationSchema.status} = 'pending')`,

        // Content status breakdown
        events_draft: sql<number>`(SELECT COUNT(*) FROM ${eventSchema} WHERE ${eventSchema.host_id} = ${id} AND ${eventSchema.status} = 'draft')`,
        events_published: sql<number>`(SELECT COUNT(*) FROM ${eventSchema} WHERE ${eventSchema.host_id} = ${id} AND ${eventSchema.status} = 'published')`,
        events_suspended: sql<number>`(SELECT COUNT(*) FROM ${eventSchema} WHERE ${eventSchema.host_id} = ${id} AND ${eventSchema.status} = 'suspended')`,
        events_cancelled: sql<number>`(SELECT COUNT(*) FROM ${eventSchema} WHERE ${eventSchema.host_id} = ${id} AND ${eventSchema.status} = 'cancelled')`,

        podcasts_draft: sql<number>`(SELECT COUNT(*) FROM ${podcastSchema} WHERE ${podcastSchema.host_id} = ${id} AND ${podcastSchema.status} = 'draft')`,
        podcasts_published: sql<number>`(SELECT COUNT(*) FROM ${podcastSchema} WHERE ${podcastSchema.host_id} = ${id} AND ${podcastSchema.status} = 'published')`,
        podcasts_archived: sql<number>`(SELECT COUNT(*) FROM ${podcastSchema} WHERE ${podcastSchema.host_id} = ${id} AND ${podcastSchema.status} = 'archived')`,

        courses_draft: sql<number>`(SELECT COUNT(*) FROM ${courseSchema} WHERE ${courseSchema.host_id} = ${id} AND ${courseSchema.status} = 'draft')`,
        courses_published: sql<number>`(SELECT COUNT(*) FROM ${courseSchema} WHERE ${courseSchema.host_id} = ${id} AND ${courseSchema.status} = 'published')`,
        courses_archived: sql<number>`(SELECT COUNT(*) FROM ${courseSchema} WHERE ${courseSchema.host_id} = ${id} AND ${courseSchema.status} = 'archived')`,

        // Time-based metrics (last 30 days)
        revenue_last_30_days: sql<number>`(SELECT COALESCE(SUM(amount), 0) FROM ${paymentSchema} 
          WHERE ${paymentSchema.beneficiary_id} = ${id} 
          AND ${paymentSchema.status} = 'succeeded'
          AND ${paymentSchema.created_at} >= DATE_SUB(NOW(), INTERVAL 30 DAY))`,

        new_leads_last_30_days: sql<number>`(SELECT COUNT(*) FROM ${leadSchema} 
          WHERE ${leadSchema.host_id} = ${id} 
          AND ${leadSchema.created_at} >= DATE_SUB(NOW(), INTERVAL 30 DAY))`,

        new_contacts_last_30_days: sql<number>`(SELECT COUNT(*) FROM ${contactSchema} 
          WHERE ${contactSchema.id} = ${id} 
          AND ${contactSchema.createdAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY))`,

        new_bookings_last_30_days: sql<number>`(SELECT COUNT(*) FROM ${bookings} 
          WHERE ${bookings.host_id} = ${id} 
          AND ${bookings.created_at} >= DATE_SUB(NOW(), INTERVAL 30 DAY))`,
      })
      .from(userSchema)
      .where(eq(userSchema.id, id));

    // Get recent payments in a separate query since it returns multiple rows
    const [recentSuccessfulPayments, recentFailedPayments, eventsStats] = await Promise.all([
      db
        .select()
        .from(paymentSchema)
        .where(and(eq(paymentSchema.beneficiary_id, id), eq(paymentSchema.status, 'succeeded')))
        .orderBy(desc(paymentSchema.created_at))
        .limit(5),
      db
        .select()
        .from(paymentSchema)
        .where(and(eq(paymentSchema.beneficiary_id, id), eq(paymentSchema.status, 'failed')))
        .orderBy(desc(paymentSchema.created_at))
        .limit(5),
      this.getAllEventsStats(id),
    ]);

    return {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile_picture: user.profile_picture,
        is_verified: user.is_verified,
        is_banned: user.is_banned,
        is_deleted: user.is_deleted,
        business: user.business,
        stripe_connect_status: user.stripe_connect_status,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
      },
      content: {
        total_events: metrics.total_events,
        total_podcasts: metrics.total_podcasts,
        total_courses: metrics.total_courses,
        total_leads: metrics.total_leads,
        total_contacts: metrics.total_contacts,
      },
      revenue: {
        total_revenue: metrics.total_revenue,
        revenue_last_30_days: metrics.revenue_last_30_days,
        active_memberships: metrics.active_memberships,
        successful_payments: metrics.successful_payments,
        failed_payments: metrics.failed_payments,
        recent_successful_payments: recentSuccessfulPayments,
        recent_failed_payments: recentFailedPayments,
      },
      engagement: {
        active_bookings: metrics.active_bookings,
        new_bookings_last_30_days: metrics.new_bookings_last_30_days,
        pending_callbacks: metrics.pending_callbacks,
        team_members: metrics.team_members,
        pending_invitations: metrics.pending_invitations,
        new_leads_last_30_days: metrics.new_leads_last_30_days,
        new_contacts_last_30_days: metrics.new_contacts_last_30_days,
      },
      content_status: {
        events: {
          draft: metrics.events_draft,
          published: metrics.events_published,
          suspended: metrics.events_suspended,
          cancelled: metrics.events_cancelled,
        },
        podcasts: {
          draft: metrics.podcasts_draft,
          published: metrics.podcasts_published,
          archived: metrics.podcasts_archived,
        },
        courses: {
          draft: metrics.courses_draft,
          published: metrics.courses_published,
          archived: metrics.courses_archived,
        },
      },
      events_stats: eventsStats,
    };
  }

  public async getAllEventsStats(id: number) {
    // Get all pre-recorded events for the user with their statistics
    const events = await db
      .select({
        event_id: eventSchema.id,
        event_name: eventSchema.event_name,
        event_type: eventSchema.event_type,
        status: eventSchema.status,
        created_at: eventSchema.created_at,
      })
      .from(eventSchema)
      .where(and(eq(eventSchema.host_id, id)));

    const eventsStats = await Promise.all(
      events.map(async (event) => {
        // Get registrations (leads for this event)
        const registrations = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(leadSchema)
          .where(eq(leadSchema.event_id, event.event_id));

        // Get attendees (leads who attended the event)
        const attendees = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(leadSchema)
          .where(and(eq(leadSchema.event_id, event.event_id), eq(leadSchema.attended_event, true)));

        // Get earnings for this event
        const earnings = await db
          .select({
            total: sql<number>`COALESCE(SUM(amount), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(paymentSchema)
          .where(
            and(
              eq(paymentSchema.event_id, event.event_id),
              eq(paymentSchema.beneficiary_id, id),
              eq(paymentSchema.status, 'succeeded'),
            ),
          );

        const registrationCount = registrations[0]?.count || 0;
        const attendeeCount = attendees[0]?.count || 0;
        const nonAttendeeCount = registrationCount - attendeeCount;
        const fallthroughRate =
          registrationCount > 0 ? (attendeeCount / registrationCount) * 100 : 0;
        const eventEarnings = earnings[0]?.total || 0;

        return {
          event_id: event.event_id,
          event_name: event.event_name,
          event_type: event.event_type,
          status: event.status,
          created_at: event.created_at,
          registrations: registrationCount,
          attendees: attendeeCount,
          non_attendees: nonAttendeeCount,
          fallthrough_rate: Math.round(fallthroughRate * 100) / 100, // Round to 2 decimal places
          earnings: eventEarnings,
        };
      }),
    );

    // Calculate totals
    const totals = eventsStats.reduce(
      (acc, event) => ({
        total_registrations: acc.total_registrations + event.registrations,
        total_attendees: acc.total_attendees + event.attendees,
        total_non_attendees: acc.total_non_attendees + event.non_attendees,
        total_earnings: acc.total_earnings + event.earnings,
      }),
      {
        total_registrations: 0,
        total_attendees: 0,
        total_non_attendees: 0,
        total_earnings: 0,
      },
    );

    // Calculate overall fallthrough rate
    const overallFallthroughRate =
      totals.total_registrations > 0
        ? (totals.total_attendees / totals.total_registrations) * 100
        : 0;

    return {
      events: eventsStats,
      totals: {
        ...totals,
        overall_fallthrough_rate: Math.round(overallFallthroughRate * 100) / 100,
      },
    };
  }
}
