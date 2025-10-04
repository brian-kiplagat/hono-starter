import { WebSocket, WebSocketServer } from 'ws';

import env from '../lib/env.ts';
import { logger } from '../lib/logger.js';
import scheduleEventEndNotification from '../task/client/scheduleEventEndNotification.js';

interface TimeSyncMessage {
  type: 'time_sync';
  eventId: number;
  currentTime: number;
  timestamp: number;
  eventStartTime: number; // Unix timestamp when event starts
  eventEndTime: number; // Unix timestamp when event ends
}

interface ClientConnection {
  ws: WebSocket;
  eventId: number;
  eventStartTime: number;
  eventEndTime: number;
}

import { EventService } from './event.ts';
import { NotificationService } from './notification.ts';
import { TelemetryService } from './telemetry.ts';

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private eventRooms: Map<number, Set<string>> = new Map();
  private timeBroadcastTimer: NodeJS.Timeout | null = null;
  private eventService: EventService;
  private eventEndTimers: Map<number, NodeJS.Timeout> = new Map();
  private telemetryService: TelemetryService;
  private notificationService: NotificationService;

  constructor(
    port: number = Number.parseInt(env.WEBSOCKET_PORT),
    eventService: EventService,
    telemetryService: TelemetryService,
    notificationService: NotificationService,
  ) {
    this.wss = new WebSocketServer({ port });
    this.eventService = eventService;
    this.telemetryService = telemetryService;
    this.notificationService = notificationService;
    this.setupWebSocketServer();
    this.startTimeBroadcast();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, _request) => {
      const clientId = this.generateClientId();
      logger.info(`New WebSocket connection: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message: TimeSyncMessage = JSON.parse(data.toString());
          this.handleMessage(clientId, message, ws);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(clientId);
        logger.info(`WebSocket connection closed: ${clientId}`);
      });

      ws.on('error', (_error) => {
        logger.error(`WebSocket error for client ${clientId}`);
        this.removeClient(clientId);
      });

      // Send initial connection confirmation
      ws.send(
        JSON.stringify({
          type: 'connected',
          clientId,
          timestamp: Date.now(),
        }),
      );
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private handleMessage(clientId: string, message: TimeSyncMessage, ws: WebSocket) {
    const { eventId, eventStartTime, eventEndTime } = message;
    const currentTime = Date.now();

    // Check if event has already ended
    if (eventEndTime && currentTime > eventEndTime) {
      logger.info(`Rejecting connection for event ${eventId} - event has already ended`);
      ws.send(
        JSON.stringify({
          type: 'event_ended',
          eventId,
          timestamp: currentTime,
        }),
      );
      ws.close(1000, 'Event has already ended');
      return;
    }

    // Store client connection info
    this.clients.set(clientId, {
      ws,
      eventId,
      eventStartTime,
      eventEndTime,
    });

    // Add to event room
    if (!this.eventRooms.has(eventId)) {
      this.eventRooms.set(eventId, new Set());
    }
    this.eventRooms.get(eventId)!.add(clientId);

    // Clear any existing end timer for this event since we have a new connection
    this.clearEventEndTimer(eventId);

    logger.debug(`Client ${clientId} joined event ${eventId}`);
  }

  private broadcastToEvent(eventId: number, message: any) {
    const room = this.eventRooms.get(eventId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const clientId of room) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
        sentCount++;
      }
    }

    logger.debug(`Broadcasted to ${sentCount} clients in event ${eventId}`);
  }

  private removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      const { eventId } = client;

      // Remove from event room
      const room = this.eventRooms.get(eventId);
      if (room) {
        room.delete(clientId);

        // If this was the last client in the event room
        if (room.size === 0) {
          this.eventRooms.delete(eventId);
          this.scheduleEventEndNotification(eventId);
        }
      }
    }
    this.clients.delete(clientId);
  }

  /**
   * Schedule a notification to be sent to the host when the event stream ends
   * We wait 30 seconds to ensure no new connections come in
   */
  private scheduleEventEndNotification(eventId: number) {
    // Only schedule if we have the event service
    if (!this.eventService) {
      logger.warn('Event service not available, skipping event end notification');
      return;
    }

    // Clear any existing timer for this event
    this.clearEventEndTimer(eventId);

    const timer = setTimeout(async () => {
      try {
        await Promise.allSettled([
          this.sendEventEndNotification(eventId),
          this.telemetryService.clearLobbyLogs(eventId),
          this.telemetryService.clearLogs(eventId),
        ]);
        this.eventEndTimers.delete(eventId);
      } catch (error) {
        logger.error(`Failed to send event end notification for event ${eventId}:`, error);
      }
    }, 30000); // 30 seconds delay

    this.eventEndTimers.set(eventId, timer);
    logger.info(`Scheduled event end notification for event ${eventId} in 30 seconds`);
  }

  /**
   * Clear the event end timer for a specific event
   */
  private clearEventEndTimer(eventId: number) {
    const timer = this.eventEndTimers.get(eventId);
    if (timer) {
      clearTimeout(timer);
      this.eventEndTimers.delete(eventId);
      logger.debug(`Cleared event end timer for event ${eventId}`);
    }
  }

  /**
   * Send notification email to the host when event stream ends
   */
  private async sendEventEndNotification(eventId: number) {
    try {
      // Get event details including host information
      const event = await this.eventService!.getEvent(eventId);
      if (!event || !event.host) {
        logger.warn(`Event ${eventId} not found or has no host`);
        return;
      }

      // Schedule the email notification using the task queue
      const { event_name, host } = event;
      const [scheduledEmail, inAppNotification] = await Promise.allSettled([
        scheduleEventEndNotification({
          eventId,
          eventName: event_name,
          hostEmail: host.email,
          hostId: host.id,
        }),
        this.notificationService.create({
          user_id: host.id,
          notification_type: 'system',
          link: `/concepts/event/event-edit/${eventId}`,
          metadata: {
            event_id: eventId,
          },
          title: `Event Ended`,
          message: `Your event "${event_name}" stream has ended. All viewers have left the webinar.`,
        }),
      ]);
      if (scheduledEmail.status === 'fulfilled' && inAppNotification.status === 'fulfilled') {
        logger.info(`Event end notification scheduled for host ${host.email} for event ${eventId}`);
      } else {
        logger.error(
          `Failed to schedule event end notification for event ${eventId}:`,
          scheduledEmail.status,
          inAppNotification.status,
        );
      }
    } catch (error) {
      logger.error(`Failed to send event end notification for event ${eventId}:`, error);
    }
  }

  /**
   * Get connected clients for an event
   */
  public getEventClients(eventId: number): number {
    const room = this.eventRooms.get(eventId);
    return room ? room.size : 0;
  }

  /**
   * Get total connected clients
   */
  public getTotalClients(): number {
    return this.clients.size;
  }

  /**
   * Start broadcasting time every 5 seconds to all connected clients
   */
  private startTimeBroadcast() {
    this.timeBroadcastTimer = setInterval(() => {
      const currentTime = Date.now();

      // Check for expired events and kick out participants
      this.checkAndKickExpiredEvents();

      // Broadcast to all event rooms
      for (const [eventId, room] of this.eventRooms) {
        if (room.size > 0) {
          this.broadcastToEvent(eventId, {
            type: 'time_sync',
            eventId,
            currentTime: Math.floor(currentTime / 1000), // Convert to seconds
            timestamp: currentTime,
          });
        }
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Check for expired events and kick out participants
   */
  private checkAndKickExpiredEvents() {
    const currentTime = Date.now(); // Use milliseconds

    for (const [eventId, room] of this.eventRooms) {
      if (room.size === 0) continue;

      // Get the first client to check event timing (all clients in same event should have same timing)
      const firstClientId = Array.from(room)[0];
      const firstClient = this.clients.get(firstClientId);

      if (!firstClient?.eventStartTime || !firstClient?.eventEndTime) continue;

      // If event has ended, kick out participants
      if (currentTime > firstClient.eventEndTime) {
        logger.info(`Event ${eventId} has expired, kicking out ${room.size} participants`);
        this.kickOutParticipants(eventId);
      }
    }
  }

  /**
   * Kick out all participants in an event room
   */
  private kickOutParticipants(eventId: number) {
    const room = this.eventRooms.get(eventId);
    if (!room) return;

    const kickMessage = JSON.stringify({
      type: 'event_ended',
      eventId,
      message: 'Event has ended. You will be disconnected.',
      timestamp: Date.now(),
    });

    let kickedCount = 0;
    for (const clientId of room) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(kickMessage);
          client.ws.close(1000, 'Event ended');
          kickedCount++;
        } catch (error) {
          logger.error(`Failed to kick client ${clientId}:`, error);
        }
      }
    }

    logger.info(`Kicked out ${kickedCount} participants from event ${eventId}`);

    // Clear the room
    this.eventRooms.delete(eventId);
  }

  /**
   * Close the WebSocket server
   */
  public close() {
    // Clear all event end timers
    for (const [eventId, timer] of this.eventEndTimers) {
      clearTimeout(timer);
      logger.debug(`Cleared event end timer for event ${eventId}`);
    }
    this.eventEndTimers.clear();

    if (this.timeBroadcastTimer) {
      clearInterval(this.timeBroadcastTimer);
      this.timeBroadcastTimer = null;
    }
    this.wss.close();
    logger.info('WebSocket server closed');
  }
}
