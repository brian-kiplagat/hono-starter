import { createEvent } from 'ics';

import { logger } from '../lib/logger.ts';
import { Business, Event, Lead, User } from '../schema/schema.ts';
import { minutesToDuration } from '../util/string.ts';
import { AssetService } from './asset.ts';

/**
 * Interface for ICS event data
 */
export interface ICSEventData {
  start: [number, number, number, number, number]; // [YYYY, M, D, H, M]
  duration: { hours: number; minutes: number };
  title: string;
  description?: string;
  location?: string;
  url?: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  organizer: { name: string; email: string };
  attendees?: Array<{ name: string; email: string }>;
}

/**
 * Service class for generating ICS calendar files
 */
export class ICSService {
  private assetService: AssetService;
  /**
   * Creates ICS content as base64 string
   * @param {ICSEventData} eventData - The event data
   * @returns {Promise<string>} Base64 encoded ICS content
   */
  constructor(assetService: AssetService) {
    this.assetService = assetService;
  }

  public createICSFile = async (eventData: ICSEventData): Promise<string> => {
    return new Promise((resolve, reject) => {
      createEvent(eventData, (error, value) => {
        if (error) {
          logger.error('Error creating ICS event:', error);
          reject(error);
          return;
        }

        try {
          const base64Content = Buffer.from(value).toString('base64');
          logger.info(base64Content);
          resolve(base64Content);
        } catch (encodeError) {
          logger.error('Error encoding ICS content:', encodeError);
          reject(encodeError);
        }
      });
    });
  };

  /**
   * Generates ICS content as string (without encoding)
   * @param {ICSEventData} eventData - The event data
   * @returns {Promise<string>} ICS content as string
   */
  public generateICSContent = async (eventData: ICSEventData): Promise<string> => {
    return new Promise((resolve, reject) => {
      createEvent(eventData, (error, value) => {
        if (error) {
          logger.error('Error creating ICS event:', error);
          reject(error);
          return;
        }
        resolve(value);
      });
    });
  };

  /**
   * Creates an attachment for an event
   * @param {Event} event - The event to create an attachment for
   * @param {Lead} lead - The lead to create an attachment for
   * @param {User} host - The host of the event
   * @param {Business} business - The business of the event
   * @param {string[]} dates - The dates of the event
   * @returns {Promise<{ content: string; name: string }[]>} The attachment
   */
  public createAttachment = async (
    event: Event,
    lead: Lead,
    host: User,
    business: Business,
    dates: number[],
    link: string,
  ): Promise<{ content: string; name: string }[]> => {
    const dateFromTimestamp = new Date(Number(dates[0]) * 1000);
    let duration = {
      hours: 0,
      minutes: 0,
    };
    if (event.event_type === 'live_venue' || event.event_type === 'live_video_call') {
      duration = {
        hours: 1,
        minutes: 0,
      };
    } else if (event.event_type === 'prerecorded') {
      const asset = await this.assetService.getAsset(Number(event.asset_id));
      if (!asset) {
        duration = {
          hours: 1,
          minutes: 0,
        };
      } else {
        const durationMinutes = asset.duration || 0;
        duration = minutesToDuration(durationMinutes);
      }
    }
    const description =
      event.event_type === 'live_venue'
        ? 'Live Venue Event'
        : event.event_type === 'live_video_call'
          ? 'Live Video Call Event'
          : 'Webinar';
    const eventData: ICSEventData = {
      start: [
        dateFromTimestamp.getUTCFullYear(),
        dateFromTimestamp.getUTCMonth() + 1, // Add 1 for correct month
        dateFromTimestamp.getUTCDate(),
        dateFromTimestamp.getUTCHours(),
        dateFromTimestamp.getUTCMinutes(),
      ] as [number, number, number, number, number],
      duration: duration,
      title: event.event_name,
      description: `${description} - ${event.event_description}`,
      location:
        event.event_type === 'live_venue'
          ? event.live_venue_address || ''
          : event.event_type === 'live_video_call'
            ? event.live_video_url || ''
            : link.trim(),
      url: link.trim(),
      status: 'CONFIRMED' as const,
      organizer: { name: host.name, email: host.email },
      attendees: [{ name: lead.name || '', email: lead.email || '' }],
    };
    const icsBase64 = await this.createICSFile(eventData);
    const attachment = [
      {
        content: icsBase64,
        name: 'event.ics',
      },
    ];
    logger.info(attachment);
    return attachment;
  };
}
