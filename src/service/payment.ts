import { logger } from '../lib/logger.js';
import type { PaymentRepository } from '../repository/payment.js';
import type { NewPayment, Payment } from '../schema/schema.js';
import { NotificationService } from './notification.js';

/**
 * Service class for managing payments, including creation, updates, and retrieval
 */
export class PaymentService {
  private paymentRepo: PaymentRepository;
  private notificationService: NotificationService;
  /**
   * Creates an instance of PaymentService
   * @param {PaymentRepository} paymentRepo - Repository for payment operations
   */
  constructor(paymentRepo: PaymentRepository, notificationService: NotificationService) {
    this.paymentRepo = paymentRepo;
    this.notificationService = notificationService;
  }

  /**
   * Creates a new payment
   * @param {NewPayment} payment - The payment information to create
   * @returns {Promise<number>} ID of the created payment
   * @throws {Error} When payment creation fails
   */
  public async createPayment(payment: NewPayment) {
    try {
      const createdPayment = await this.paymentRepo.createPayment(payment);
      //create a notification only for free payments
      if (Number(payment.amount) <= 0) {
        await this.notificationService.create({
          user_id: payment.beneficiary_id,
          notification_type: 'new_payment',
          link: `/concepts/event/event-edit/${payment.event_id}`,
          metadata: {
            lead_id: payment.lead_id,
            situation_id: payment.event_id,
            situation_name: payment.metadata?.situation_name,
            lead_name: payment.metadata?.lead_name,
            lead_email: payment.metadata?.lead_email,
            dates: payment.metadata?.dates,
          },
          title: `New payment`,
          message: `${payment.metadata?.lead_name} has paid ${payment.amount} GBP for "${payment.metadata?.situation_name}"`,
        });
      }
      return createdPayment;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Updates an existing payment
   * @param {number} id - ID of the payment to update
   * @param {Partial<Payment>} payment - Updated payment information
   * @returns {Promise<Payment>} The updated payment
   * @throws {Error} When payment update fails
   */
  public async updatePayment(id: number, payment: Partial<Payment>) {
    try {
      return await this.paymentRepo.updatePayment(id, payment);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Updates a payment using its session ID
   * @param {string} sessionId - Session ID of the payment
   * @param {Partial<Payment>} payment - Updated payment information
   * @returns {Promise<Payment>} The updated payment
   * @throws {Error} When payment update fails
   */
  public async updatePaymentBySessionId(sessionId: string, payment: Partial<Payment>) {
    try {
      return await this.paymentRepo.updatePaymentBySessionId(sessionId, payment);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Finds payments associated with a contact
   * @param {number} contactId - ID of the contact
   * @returns {Promise<Payment[]>} List of payments for the contact
   * @throws {Error} When payment retrieval fails
   */
  public async findByContactId(contactId: number) {
    try {
      return await this.paymentRepo.findPaymentsByContactId(contactId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Finds payments associated with a lead
   * @param {number} leadId - ID of the lead
   * @returns {Promise<Payment[]>} List of payments for the lead
   * @throws {Error} When payment retrieval fails
   */
  public async findByLeadId(leadId: number) {
    try {
      return await this.paymentRepo.findPaymentsByLeadId(leadId);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
