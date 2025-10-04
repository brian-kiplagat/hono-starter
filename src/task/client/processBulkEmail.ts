import { logger } from '../../lib/logger.ts';
import { defaultQueue } from '../../lib/queue.ts';
import { TASK } from '../tasker.ts';

const processBulkEmailAsync = async (data: {
  email: string;
  name: string;
  params: Record<string, string>;
  templateId: number;
}) => {
  const job = await defaultQueue.add(TASK.BulkSendFollowUpEmails, data);
  logger.info(
    `Job ${job.id} added to queue. Task scheduled for ${TASK.BulkSendFollowUpEmails}, email: ${data.email}`,
  );
};

export default processBulkEmailAsync;
