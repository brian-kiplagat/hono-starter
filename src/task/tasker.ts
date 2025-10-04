import { type Job, Worker } from 'bullmq';

import { logger } from '../lib/logger.js';
import { connection, QUEUE } from '../lib/queue.js';
import type { EmailService } from '../service/email.js';
import type { UserService } from '../service/user.js';
import { sendTemplateEmail } from './email-processor.ts';

const TASK = {
  SendWelcomeEmail: 'send_code_completion',
  ProcessEmail: 'process_email',
  BulkSendFollowUpEmails: 'bulk_send_follow_up_emails',
  EventEndNotification: 'event_end_notification',
};

class Tasker {
  private readonly userService: UserService;
  private readonly emailService: EmailService;

  constructor(userService: UserService, emailService: EmailService) {
    this.userService = userService;
    this.emailService = emailService;

    this.setup = this.setup.bind(this);
    this.processor = this.processor.bind(this);
  }

  public setup() {
    const worker = new Worker(QUEUE.default, this.processor, { connection });

    worker.on('completed', (job: Job) => {
      logger.info(`Job ${job.id} completed, task name: ${job.name}`);
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        logger.error(`Job ${job.id} failed, task name: ${job.name}, error: ${error.message}`);
      } else {
        logger.error(`Job failed, error: ${error.message}`);
      }
    });

    worker.on('error', (err) => {
      logger.error(err);
    });

    return worker;
  }

  private async processor(job: Job) {
    switch (job.name) {
      case TASK.SendWelcomeEmail: {
        //await sendTransactionalEmail(job.data, this.userService);
        break;
      }
      case TASK.ProcessEmail: {
        const { email, name, templateId, emailData } = job.data;

        await sendTemplateEmail(email, name, templateId, emailData);
        break;
      }
      case TASK.BulkSendFollowUpEmails: {
        const { email, name, templateId, params } = job.data;
        await sendTemplateEmail(email, name, templateId, params);
        break;
      }
      case TASK.EventEndNotification: {
        const { eventId, eventName, hostEmail, hostId } = job.data;

        // Send event end notification email
        await this.emailService.createEmail({
          email: hostEmail,
          subject: `Event Stream Ended - ${eventName}`,
          title: 'Event Stream Completed',
          subtitle: 'Your event stream has ended',
          body: `Your event "${eventName}" stream has ended. All viewers have disconnected from the stream. We have compiled for you a list of all the messages sent during the event.`,
          button_text: 'Download Chat Logs',
          button_link: `${process.env.FRONTEND_URL}/concepts/event/event-edit/${eventId}?action=download-chat-logs`,
          host_id: hostId,
        });

        logger.info(`Event end notification sent to host ${hostEmail} for event ${eventId}`);
        break;
      }
    }
  }
}

export { TASK, Tasker };
