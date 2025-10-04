import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import type { Worker } from 'bullmq';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { connection } from '../lib/queue.js';
import { EmailRepository } from '../repository/email.ts';
import { EventRepository } from '../repository/event.ts';
import { NotificationRepository } from '../repository/notification.ts';
import { PaymentRepository } from '../repository/payment.ts';
import { SubscriptionRepository } from '../repository/subscription.js';
import { UserRepository } from '../repository/user.js';
import { EmailService } from '../service/email.ts';
import { EventService } from '../service/event.ts';
import { GoogleService } from '../service/google.js';
import { ICSService } from '../service/ics.ts';
import { NotificationService } from '../service/notification.ts';
import { PaymentService } from '../service/payment.ts';
import { S3Service } from '../service/s3.js';
import { StripeService } from '../service/stripe.js';
import { SubscriptionService } from '../service/subscription.js';
import { UserService } from '../service/user.js';
import { WebSocketService } from '../service/websocket.ts';
import { Tasker } from '../task/tasker.js';
import { AuthController } from './controller/auth.js';
import { EmailController } from './controller/email.ts';
import { EventController } from './controller/event.ts';
import { GoogleController } from './controller/google.js';
import { NotificationController } from './controller/notification.ts';
import { ERRORS, serveInternalServerError, serveNotFound } from './controller/resp/error.js';
import { S3Controller } from './controller/s3.js';
import { StripeController } from './controller/stripe.js';
import { SubscriptionController } from './controller/subscription.js';
import { teamAccess } from './middleware/team.ts';
import {
  bulkEmailValidator,
  createBulkEmailValidator,
  toggleBulkEmailValidator,
  updateBulkEmailValidator,
  updateFollowUpEmailValidator,
} from './validator/email.ts';
import {
  cancelEventValidator,
  eventStreamValidator,
  eventValidator,
  updateEventValidator,
} from './validator/event.ts';
import { eventQueryValidator } from './validator/event.ts';
import {
  createNotificationValidator,
  updateNotificationValidator,
} from './validator/notification.ts';
import { subscriptionRequestValidator } from './validator/subscription.ts';
import {
  emailVerificationValidator,
  inAppResetPasswordValidator,
  loginValidator,
  registerTokenValidator,
  registrationValidator,
  requestResetPasswordValidator,
  resetPasswordValidator,
  updateUserDetailsValidator,
  uploadProfileImageValidator,
} from './validator/user.js';

export class Server {
  private app: Hono;
  private worker?: Worker;
  private wsService?: WebSocketService;

  constructor(app: Hono) {
    this.app = app;
  }

  public async configure() {
    // Index path
    this.app.get('/', (c) => {
      return c.text('Ok');
    });

    // Static files
    this.app.use('/static/*', serveStatic({ root: './' }));

    // API Doc
    this.app.get('/doc', swaggerUI({ url: '/static/openapi.yaml' }));

    // Universal catchall
    this.app.notFound((c) => {
      return serveNotFound(c, ERRORS.NOT_FOUND);
    });

    // Error handling
    this.app.onError((err, c) => {
      return serveInternalServerError(c, err);
    });

    const api = this.app.basePath('/v1');

    // Setup repos
    const userRepo = new UserRepository();
    const eventRepo = new EventRepository();
    const subscriptionRepo = new SubscriptionRepository();
    const paymentRepo = new PaymentRepository();
    const emailRepo = new EmailRepository();
    const notificationRepo = new NotificationRepository();
    // Setup services
    const notificationService = new NotificationService(notificationRepo);
    const s3Service = new S3Service();
    const stripeService = new StripeService();

    // Initialize Stripe service with AWS Secrets Manager
    await stripeService.initialize();

    const eventService = new EventService(eventRepo, s3Service, null, null);
    const userService = new UserService(
      userRepo,
      stripeService,
      null,
      eventService,
      null,
    );
    const subscriptionService = new SubscriptionService(
      subscriptionRepo,
      stripeService,
      userService,
    );
    const paymentService = new PaymentService(paymentRepo, notificationService);
    const emailService = new EmailService(emailRepo);
    const icsService = new ICSService(null);
    // Setup workers
    this.registerWorker(userService, emailService);

    // Setup controllers
    const authController = new AuthController(
      userService,
      null,
      s3Service,
      null,
      userRepo,
    );
    const eventController = new EventController(
      eventService,
      userService,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );
    const s3Controller = new S3Controller(s3Service);

    const stripeController = new StripeController(
      stripeService,
      userService,
      subscriptionRepo,
      null,
      paymentService,
      eventService,
      null,
      null,
      null,
      notificationService,
      icsService,
    );
    const subscriptionController = new SubscriptionController(
      subscriptionService,
      stripeService,
      userService,
    );
    const emailController = new EmailController(
      emailService,
      userService,
      null,
      null,
      eventService,
      null,
    );

    // Add Google service and controller
    const googleService = new GoogleService(userService, stripeService);
    const googleController = new GoogleController(googleService, s3Service, userRepo);

    const notificationController = new NotificationController(notificationService, userService);
    // Register routes
    this.registerUserRoutes(api, authController, googleController);
    this.registerEventRoutes(api, eventController);
    this.registerS3Routes(api, s3Controller);
    this.registerStripeRoutes(api, stripeController);
    this.registerSubscriptionRoutes(api, subscriptionController);
    this.registerEmailRoutes(api, emailController);
    this.registerNotificationRoutes(api, notificationController);

    // Initialize WebSocket service with existing event service
    this.wsService = new WebSocketService(
      Number.parseInt(env.WEBSOCKET_PORT),
      eventService,
      notificationService,
    );
    logger.info(`WebSocket service initialized on port: ${env.WEBSOCKET_PORT}`);
  }

  private registerUserRoutes(api: Hono, authCtrl: AuthController, googleCtrl: GoogleController) {
    const user = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    user.get('/me', authCheck, authCtrl.me);
    user.get('/dashboard', authCheck, authCtrl.getDashboard);
    user.post('/login', loginValidator, authCtrl.login);
    user.post('/register', registrationValidator, authCtrl.register);
    user.post('/send-token', emailVerificationValidator, authCtrl.sendToken);
    user.post('/verify-registration', registerTokenValidator, authCtrl.verifyRegistrationToken);
    user.post(
      '/request-reset-password',
      requestResetPasswordValidator,
      authCtrl.requestResetPassword,
    );
    user.post('/reset-password', resetPasswordValidator, authCtrl.resetPassword);
    user.post(
      '/reset-password-in-app',
      authCheck,
      inAppResetPasswordValidator,
      authCtrl.resetPasswordInApp,
    );
    user.put('/details', authCheck, updateUserDetailsValidator, authCtrl.updateUserDetails);

    // Add Google auth routes
    user.get('/auth/google', googleCtrl.initiateAuth);
    user.get('/auth/google/callback', googleCtrl.handleCallback);
    user.post(
      '/upload-profile-image',
      authCheck,
      uploadProfileImageValidator,
      authCtrl.uploadProfileImage,
    );
    api.route('/user', user);
  }


  private registerEventRoutes(api: Hono, eventCtrl: EventController) {
    const event = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // Unauthenticated routes
    event.get('/server-time', eventCtrl.getServerTime);
    event.get('/:id', eventCtrl.getEvent);
    event.post('/stream', eventStreamValidator, eventCtrl.streamPrerecordedEvent);

    // Apply auth middleware for authenticated routes
    event.use(authCheck);

    // Authenticated routes
    event.get('/', eventQueryValidator, eventCtrl.getEvents);
    event.post('/', eventValidator, eventCtrl.createEvent);
    event.put('/:id', updateEventValidator, eventCtrl.updateEvent);
    event.delete('/:id', eventCtrl.deleteEvent);
    event.post('/cancel', cancelEventValidator, eventCtrl.cancelEvent);

    api.route('/event', event);
  }


  private registerS3Routes(api: Hono, s3Ctrl: S3Controller) {
    const s3 = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    s3.post('/presigned-url', authCheck, s3Ctrl.generatePresignedUrl);
    api.route('/s3', s3);
  }


  private registerStripeRoutes(api: Hono, stripeCtrl: StripeController) {
    const stripe = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // OAuth routes
    stripe.get('/connect/oauth', authCheck, stripeCtrl.initiateOAuth);
    stripe.get('/connect/oauth/callback', authCheck, stripeCtrl.handleOAuthCallback);
    stripe.get('/product/:id/:priceId', authCheck, stripeCtrl.getProduct);
    stripe.get('/list/payment/methods', authCheck, stripeCtrl.getCardDetails);

    // Webhook
    stripe.post('/webhook', stripeCtrl.handleWebhook);

    api.route('/stripe', stripe);
  }

  private registerSubscriptionRoutes(api: Hono, subscriptionCtrl: SubscriptionController) {
    const subscription = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    subscription.get('/', authCheck, subscriptionCtrl.getSubscriptions);
    subscription.post(
      '/subscribe',
      authCheck,
      subscriptionRequestValidator,
      subscriptionCtrl.subscribe,
    );
    subscription.delete('/', authCheck, subscriptionCtrl.cancelSubscription);

    api.route('/subscription', subscription);
  }







  private registerEmailRoutes(api: Hono, emailCtrl: EmailController) {
    const email = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });
    // Automated email routes (triggered by cron jobs)
    email.get('/trigger/countdown', emailCtrl.triggerEmailEventCountdown);
    email.get('/trigger/final-reminder', emailCtrl.triggerEmailFinalReminder);
    email.get('/trigger/event-day', emailCtrl.triggerEmailEventDayReminder);
    email.get('/trigger/thank-you', emailCtrl.triggerEmailThankYouFollowUp);

    // Apply auth middleware for authenticated routes
    email.use(authCheck);

    email.post('/', bulkEmailValidator, emailCtrl.createBulkEmail);
    email.post('/toggle', toggleBulkEmailValidator, emailCtrl.toggleBulkEmail);
    email.get('/', emailCtrl.getEmails);
    email.post('/follow-up', createBulkEmailValidator, emailCtrl.createFollowUpEmail);
    email.get('/follow-up', emailCtrl.getFollowUpEmails);
    email.put('/follow-up/:id', updateFollowUpEmailValidator, emailCtrl.updateFollowUpEmail);
    email.delete('/follow-up/:id', emailCtrl.deleteFollowUpEmail);
    email.get('/:id', emailCtrl.getEmail);
    email.put('/:id', updateBulkEmailValidator, emailCtrl.updateEmail);
    email.delete('/:id', emailCtrl.deleteEmail);

    api.route('/email', email);
  }




  private registerNotificationRoutes(api: Hono, notificationCtrl: NotificationController) {
    const notification = new Hono();
    const authCheck = jwt({ secret: env.SECRET_KEY });

    // Apply auth middleware for all notification routes
    notification.use(authCheck);

    // Notification routes
    notification.post('/', createNotificationValidator, notificationCtrl.createNotification);
    notification.get('/my', notificationCtrl.getMyNotifications);
    notification.get('/my/unread', notificationCtrl.getMyUnreadNotifications);
    notification.get('/unread-count', notificationCtrl.getUnreadCount);
    notification.get('/:id', notificationCtrl.getNotification);
    notification.put('/:id', updateNotificationValidator, notificationCtrl.updateNotification);
    notification.post('/:id/read', notificationCtrl.markAsRead);
    notification.post('/mark-all-read', notificationCtrl.markAllAsRead);
    notification.delete('/:id', notificationCtrl.deleteNotification);
    notification.delete('/all', notificationCtrl.deleteAllNotifications);

    api.route('/notification', notification);
  }


  private registerWorker(userService: UserService, emailService: EmailService) {
    const tasker = new Tasker(userService, emailService);
    const worker = tasker.setup();
    if (worker.isRunning()) {
      logger.info('Worker is running');
    }
    this.worker = worker;
  }

  public async shutDownWorker() {
    await this.worker?.close();
    await connection.quit();
  }

  /**
   * Get WebSocket service instance
   */
  public getWebSocketService(): WebSocketService | undefined {
    return this.wsService;
  }

  /**
   * Close WebSocket service
   */
  public closeWebSocketService() {
    if (this.wsService) {
      this.wsService.close();
      logger.info('WebSocket service closed');
    }
  }
}
