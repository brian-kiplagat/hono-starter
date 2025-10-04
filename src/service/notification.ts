import { logger } from '../lib/logger.ts';
import type { NotificationRepository } from '../repository/notification.ts';
import type { NewNotification } from '../schema/schema.ts';

/**
 * Service class for managing notifications
 */
export class NotificationService {
  private repo: NotificationRepository;

  constructor(notificationRepo: NotificationRepository) {
    this.repo = notificationRepo;
  }

  /**
   * Creates a new notification
   * @param {NewNotification} notification - The notification details to create
   * @returns {Promise<number>} ID of the created notification
   * @throws {Error} When notification creation fails
   */
  public async create(notification: NewNotification): Promise<number> {
    try {
      const record = await this.repo.create(notification);
      return record[0].id;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Finds notification by its ID
   * @param {number} id - ID of the notification
   * @returns {Promise<Notification|undefined>} The notification if found
   * @throws {Error} When notification retrieval fails
   */
  public async findById(id: number) {
    try {
      return await this.repo.findById(id);
    } catch (error) {
      logger.error('Failed to find notification:', error);
      throw error;
    }
  }

  /**
   * Finds all notifications for a specific user
   * @param {number} userId - ID of the user
   * @returns {Promise<Notification[]>} List of notifications for the user
   * @throws {Error} When notification retrieval fails
   */
  public async findByUserId(userId: number) {
    try {
      return await this.repo.findByUserId(userId);
    } catch (error) {
      logger.error('Failed to find notifications by user ID:', error);
      throw error;
    }
  }

  /**
   * Finds all unread notifications for a specific user
   * @param {number} userId - ID of the user
   * @returns {Promise<Notification[]>} List of unread notifications for the user
   * @throws {Error} When notification retrieval fails
   */
  public async findUnreadByUserId(userId: number) {
    try {
      return await this.repo.findUnreadByUserId(userId);
    } catch (error) {
      logger.error('Failed to find unread notifications by user ID:', error);
      throw error;
    }
  }

  /**
   * Updates an existing notification
   * @param {number} id - ID of the notification to update
   * @param {Partial<NewNotification>} data - Updated notification data
   * @returns {Promise<number>} ID of the updated notification
   * @throws {Error} When notification update fails
   */
  public async update(id: number, data: Partial<NewNotification>): Promise<void> {
    try {
      await this.repo.update(id, data);
    } catch (error) {
      logger.error('Failed to update notification:', error);
      throw error;
    }
  }

  /**
   * Marks a notification as read
   * @param {number} id - ID of the notification to mark as read
   * @returns {Promise<number>} ID of the updated notification
   * @throws {Error} When marking notification as read fails
   */
  public async markAsRead(id: number): Promise<void> {
    try {
      await this.repo.markAsRead(id);
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Marks all notifications for a user as read
   * @param {number} userId - ID of the user
   * @returns {Promise<void>}
   * @throws {Error} When marking notifications as read fails
   */
  public async markAllAsRead(userId: number): Promise<void> {
    try {
      await this.repo.markAllAsRead(userId);
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Deletes a notification
   * @param {number} id - ID of the notification to delete
   * @returns {Promise<void>}
   * @throws {Error} When notification deletion fails
   */
  public async delete(id: number): Promise<void> {
    try {
      await this.repo.delete(id);
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      throw error;
    }
  }

  /**
   * Deletes all notifications for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<void>}
   * @throws {Error} When notification deletion fails
   */
  public async deleteByUserId(userId: number): Promise<void> {
    try {
      await this.repo.deleteByUserId(userId);
    } catch (error) {
      logger.error('Failed to delete notifications by user ID:', error);
      throw error;
    }
  }

  /**
   * Gets the count of unread notifications for a user
   * @param {number} userId - ID of the user
   * @returns {Promise<number>} Count of unread notifications
   * @throws {Error} When getting unread count fails
   */
  public async getUnreadCount(userId: number): Promise<number> {
    try {
      return await this.repo.getUnreadCount(userId);
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      throw error;
    }
  }
}
