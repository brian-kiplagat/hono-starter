import type { Context } from 'hono';

import { logger } from '../../lib/logger.js';
import type { NotificationService } from '../../service/notification.js';
import { UserService } from '../../service/user.js';
import {
  type CreateNotificationBody,
  type UpdateNotificationBody,
} from '../validator/notification.js';
import { ERRORS, serveBadRequest, serveNotFound } from './resp/error.js';

export class NotificationController {
  private notificationService: NotificationService;
  private userService: UserService;

  constructor(notificationService: NotificationService, userService: UserService) {
    this.notificationService = notificationService;
    this.userService = userService;
  }

  /**
   * Retrieves user information from JWT payload
   * @private
   * @param {Context} c - The Hono context containing JWT payload
   * @returns {Promise<User|null>} The user object if found, null otherwise
   */
  private getUser = async (c: Context) => {
    const { email } = c.get('jwtPayload');
    const user = await this.userService.findByEmail(email);
    return user;
  };

  /**
   * Creates a new notification
   * @param {Context} c - The Hono context containing notification details
   * @returns {Promise<Response>} Response containing created notification information
   * @throws {Error} When notification creation fails
   */
  public createNotification = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const body: CreateNotificationBody = await c.req.json();
      const { user_id, notification_type, message, link, metadata } = body;

      // Validate that the user can create notifications for the specified user_id
      if (user.id !== user_id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      const notificationId = await this.notificationService.create({
        user_id,
        notification_type,
        message,
        link,
        metadata,
      });

      return c.json({
        success: true,
        notification_id: notificationId,
      });
    } catch (error) {
      logger.error('Failed to create notification:', error);
      return serveBadRequest(c, 'Failed to create notification');
    }
  };

  /**
   * Retrieves all notifications for the authenticated user
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing list of notifications
   * @throws {Error} When fetching notifications fails
   */
  public getMyNotifications = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const [notifications, unreadNotifications, count] = await Promise.all([
        this.notificationService.findByUserId(user.id),
        this.notificationService.findUnreadByUserId(user.id),
        this.notificationService.getUnreadCount(user.id),
      ]);

      return c.json({
        success: true,
        notifications,
        unreadNotifications,
        count,
      });
    } catch (error) {
      logger.error('Failed to get notifications:', error);
      return serveBadRequest(c, 'Failed to get notifications');
    }
  };

  /**
   * Retrieves all unread notifications for the authenticated user
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing list of unread notifications
   * @throws {Error} When fetching unread notifications fails
   */
  public getMyUnreadNotifications = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const notifications = await this.notificationService.findUnreadByUserId(user.id);

      return c.json({
        success: true,
        notifications,
      });
    } catch (error) {
      logger.error('Failed to get unread notifications:', error);
      return serveBadRequest(c, 'Failed to get unread notifications');
    }
  };

  /**
   * Gets the count of unread notifications for the authenticated user
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response containing unread count
   * @throws {Error} When getting unread count fails
   */
  public getUnreadCount = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const count = await this.notificationService.getUnreadCount(user.id);

      return c.json({
        success: true,
        count,
      });
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      return serveBadRequest(c, 'Failed to get unread count');
    }
  };

  /**
   * Retrieves a specific notification by ID
   * @param {Context} c - The Hono context containing notification ID
   * @returns {Promise<Response>} Response containing notification details
   * @throws {Error} When fetching notification fails
   */
  public getNotification = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const notification = await this.notificationService.findById(id);

      if (!notification) {
        return serveNotFound(c, 'Notification not found');
      }

      // Ensure user can only access their own notifications
      if (notification.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      return c.json({
        success: true,
        notification,
      });
    } catch (error) {
      logger.error('Failed to get notification:', error);
      return serveBadRequest(c, 'Failed to get notification');
    }
  };

  /**
   * Updates an existing notification
   * @param {Context} c - The Hono context containing notification details
   * @returns {Promise<Response>} Response indicating update status
   * @throws {Error} When notification update fails
   */
  public updateNotification = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));
      const body: UpdateNotificationBody = await c.req.json();

      // Check if notification exists and belongs to user
      const existingNotification = await this.notificationService.findById(id);
      if (!existingNotification) {
        return serveNotFound(c, 'Notification not found');
      }

      if (existingNotification.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.notificationService.update(id, body);

      return c.json({
        success: true,
        message: 'Notification updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update notification:', error);
      return serveBadRequest(c, 'Failed to update notification');
    }
  };

  /**
   * Marks a notification as read
   * @param {Context} c - The Hono context containing notification ID
   * @returns {Promise<Response>} Response indicating read status
   * @throws {Error} When marking notification as read fails
   */
  public markAsRead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));

      // Check if notification exists and belongs to user
      const existingNotification = await this.notificationService.findById(id);
      if (!existingNotification) {
        return serveNotFound(c, 'Notification not found');
      }

      if (existingNotification.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.notificationService.markAsRead(id);

      return c.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      return serveBadRequest(c, 'Failed to mark notification as read');
    }
  };

  /**
   * Marks all notifications for the authenticated user as read
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response indicating read status
   * @throws {Error} When marking notifications as read fails
   */
  public markAllAsRead = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      await this.notificationService.markAllAsRead(user.id);

      return c.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      return serveBadRequest(c, 'Failed to mark all notifications as read');
    }
  };

  /**
   * Deletes a notification
   * @param {Context} c - The Hono context containing notification ID
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When notification deletion fails
   */
  public deleteNotification = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      const id = parseInt(c.req.param('id'));

      // Check if notification exists and belongs to user
      const existingNotification = await this.notificationService.findById(id);
      if (!existingNotification) {
        return serveNotFound(c, 'Notification not found');
      }

      if (existingNotification.user_id !== user.id) {
        return serveBadRequest(c, ERRORS.NOT_ALLOWED);
      }

      await this.notificationService.delete(id);

      return c.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      return serveBadRequest(c, 'Failed to delete notification');
    }
  };

  /**
   * Deletes all notifications for the authenticated user
   * @param {Context} c - The Hono context
   * @returns {Promise<Response>} Response indicating deletion status
   * @throws {Error} When notification deletion fails
   */
  public deleteAllNotifications = async (c: Context) => {
    try {
      const user = await this.getUser(c);
      if (!user) {
        return serveBadRequest(c, ERRORS.USER_NOT_FOUND);
      }

      await this.notificationService.deleteByUserId(user.id);

      return c.json({
        success: true,
        message: 'All notifications deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete all notifications:', error);
      return serveBadRequest(c, 'Failed to delete all notifications');
    }
  };
}
