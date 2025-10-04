import { Queue } from 'bullmq';

import { logger } from '../../lib/logger.js';
import { connection, QUEUE } from '../../lib/queue.js';
import { TASK } from '../tasker.js';

interface EventEndNotificationData {
  eventId: number;
  eventName: string;
  hostEmail: string;
  hostId: number;
}

/**
 * Schedule an event end notification to be sent after a delay
 * @param data - Event end notification data
 * @param delay - Delay in milliseconds (default: 30 seconds)
 */
export default async function scheduleEventEndNotification(
  data: EventEndNotificationData,
  delay: number = 30000, // 30 seconds default
): Promise<void> {
  try {
    const queue = new Queue(QUEUE.default, { connection });

    const job = await queue.add(TASK.EventEndNotification, data, {
      delay, // Delay the job execution
      removeOnComplete: 10, // Keep last 10 completed jobs
      removeOnFail: 5, // Keep last 5 failed jobs
    });

    logger.info(
      `Event end notification scheduled for event ${data.eventId} in ${delay}ms. Job ID: ${job.id}`,
    );
  } catch (error) {
    logger.error('Failed to schedule event end notification:', error);
    throw error;
  }
}
