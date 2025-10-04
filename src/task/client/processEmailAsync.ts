import { logger } from '../../lib/logger.js';
import { defaultQueue } from '../../lib/queue.js';
import { TASK } from '../tasker.js';

interface EmailData {
  email: string;
  name: string;
  templateId: number;
  emailData: {
    subject: string;
    title: string;
    subtitle: string;
    body: string;
    buttonText: string;
    buttonLink: string;
    username: string;
    eventname: string;
    eventdate: string;
    eventtime: string;
    eventlink: string;
    busname: string;
    busemail: string;
    busaddress: string;
  };
}

const processEmailAsync = async (data: EmailData) => {
  const job = await defaultQueue.add(TASK.ProcessEmail, data);
  logger.info(
    `Job ${job.id} added to queue. Task scheduled for ${TASK.ProcessEmail}, email: ${data.email}`,
  );
};

export default processEmailAsync;
