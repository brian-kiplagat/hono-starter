# Event Stream End Detection & Host Notification System

This document explains how the system detects when an event stream has ended and sends a dummy email notification to the host.

## Overview

The system provides two approaches for detecting when an event stream ends and notifying the host:

1. **WebSocket Connection Monitoring** (Primary approach)
2. **Scheduled Task-Based Detection** (Alternative approach)

## How It Works

### Approach 1: WebSocket Connection Monitoring

The system monitors WebSocket connections for each event and detects when all clients have disconnected from a specific event stream.

#### Key Components:

1. **WebSocketService** (`src/service/websocket.ts`)

   - Monitors client connections per event
   - Tracks event rooms and client disconnections
   - Schedules notifications when all clients disconnect

2. **Event End Detection Logic**:

   ```typescript
   // When a client disconnects
   if (room.size === 0) {
     this.eventRooms.delete(eventId);
     this.scheduleEventEndNotification(eventId);
   }
   ```

3. **30-Second Delay**:

   - Waits 30 seconds after the last client disconnects
   - Prevents false positives from temporary disconnections
   - Allows time for new connections to arrive

4. **Host Notification**:
   - Retrieves event details and host information
   - Schedules email notification via task queue
   - Sends dummy email with event completion details

### Approach 2: Scheduled Task-Based Detection

Uses the BullMQ task queue system for robust, scalable event end notifications.

#### Key Components:

1. **Tasker** (`src/task/tasker.ts`)

   - Processes `EventEndNotification` tasks
   - Handles email sending via background jobs

2. **Schedule Client** (`src/task/client/scheduleEventEndNotification.ts`)

   - Schedules delayed email notifications
   - Configurable delay (default: 30 seconds)

3. **Email Template**:
   ```typescript
   {
     email: hostEmail,
     subject: `Event Stream Ended - ${eventName}`,
     title: 'Event Stream Completed',
     subtitle: 'Your event stream has ended',
     body: `Your event "${eventName}" stream has ended. All viewers have disconnected from the stream.`,
     button_text: 'View Event Dashboard',
     button_link: `${FRONTEND_URL}/events/${eventId}`,
     host_id: hostId,
   }
   ```

## Configuration

### Environment Variables

- `WEBSOCKET_PORT`: WebSocket server port (default: 8081)
- `FRONTEND_URL`: Frontend URL for email links
- `REDIS_HOST`: Redis host for task queue
- `REDIS_PORT`: Redis port for task queue

### Database Schema

The system uses existing database tables:

- `events`: Event information
- `users`: Host information
- `emails`: Email records

## Usage

### Automatic Detection

The system automatically detects event stream endings:

1. **Client connects** to WebSocket with event ID
2. **Client disconnects** from WebSocket
3. **System checks** if this was the last client for the event
4. **If yes**: Schedules notification after 30-second delay
5. **If new client connects**: Cancels pending notification
6. **After delay**: Sends email notification to host

### Manual Testing

You can test the system by:

1. **Starting an event stream** with multiple clients
2. **Disconnecting all clients** from the WebSocket
3. **Waiting 30 seconds** for the notification
4. **Checking host email** for the notification

## Monitoring

### Logs

The system logs key events:

```typescript
logger.info(`Scheduled event end notification for event ${eventId} in 30 seconds`);
logger.info(`Event end notification scheduled for host ${hostEmail} for event ${eventId}`);
logger.error(`Failed to send event end notification for event ${eventId}:`, error);
```

### Metrics

Available metrics:

- `getEventClients(eventId)`: Number of connected clients for an event
- `getTotalClients()`: Total connected clients across all events

## Error Handling

### Graceful Degradation

- If event service is unavailable: Logs warning, skips notification
- If email service fails: Logs error, retries via task queue
- If Redis is down: Falls back to in-memory timers

### Retry Logic

- Task queue provides automatic retry for failed email sends
- WebSocket reconnection handles temporary disconnections
- Timer cleanup prevents memory leaks

## Performance Considerations

### Memory Usage

- Event timers are cleaned up automatically
- Client connections are tracked efficiently
- Task queue jobs are removed after completion

### Scalability

- WebSocket service can handle multiple events simultaneously
- Task queue distributes email sending load
- Redis provides persistence for scheduled jobs

## Troubleshooting

### Common Issues

1. **No email received**:

   - Check Redis connection
   - Verify email service configuration
   - Check logs for errors

2. **False notifications**:

   - Increase delay time (currently 30 seconds)
   - Check for client reconnection logic
   - Verify event room cleanup

3. **Memory leaks**:
   - Ensure timers are cleared on service shutdown
   - Check for proper client cleanup
   - Monitor Redis job cleanup

### Debug Commands

```bash
# Check WebSocket connections
curl -X GET "http://localhost:8081/health"

# Check task queue status
redis-cli LLEN bull:default

# View recent logs
tail -f logs/app.log | grep "Event end"
```

## Future Enhancements

### Potential Improvements

1. **Configurable delays**: Allow per-event notification delays
2. **Multiple notification types**: SMS, push notifications
3. **Analytics integration**: Track event completion metrics
4. **Host preferences**: Allow hosts to configure notification settings
5. **Batch notifications**: Group multiple event end notifications

### Monitoring Dashboard

Consider adding:

- Real-time event stream status
- Notification delivery tracking
- Performance metrics
- Error rate monitoring

## Security Considerations

### Data Protection

- Host emails are handled securely
- Event data is validated before processing
- Task queue jobs are encrypted

### Access Control

- WebSocket connections are validated
- Event access is controlled by authentication
- Email sending requires proper authorization

## Conclusion

This system provides reliable detection of event stream endings and ensures hosts are notified when their events complete. The dual approach (WebSocket monitoring + task queue) ensures robustness and scalability.
