import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import type { Worker } from 'bullmq';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { connection } from '../lib/queue.js';
import { EmailRepository } from '../repository/email.ts';
import { NotificationRepository } from '../repository/notification.ts';
import { UserRepository } from '../repository/user.js';
import { EmailService } from '../service/email.ts';
import { GoogleService } from '../service/google.js';
import { NotificationService } from '../service/notification.ts';
import { S3Service } from '../service/s3.js';
import { UserService } from '../service/user.js';
import { Tasker } from '../task/tasker.js';
import { AuthController } from './controller/auth.js';
import { EmailController } from './controller/email.ts';
import { GoogleController } from './controller/google.js';
import { NotificationController } from './controller/notification.ts';
import { ERRORS, serveInternalServerError, serveNotFound } from './controller/resp/error.js';
import {
  bulkEmailValidator,
  createBulkEmailValidator,
  toggleBulkEmailValidator,
  updateBulkEmailValidator,
  updateFollowUpEmailValidator,
} from './validator/email.ts';
import {
  createNotificationValidator,
  updateNotificationValidator,
} from './validator/notification.ts';
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
    const emailRepo = new EmailRepository();
    const notificationRepo = new NotificationRepository();
    // Setup services
    const notificationService = new NotificationService(notificationRepo);
    const s3Service = new S3Service();
    const userService = new UserService(userRepo, null, null, null, null);
    const emailService = new EmailService(emailRepo);
    // Setup workers
    this.registerWorker(userService, emailService);

    // Setup controllers
    const authController = new AuthController(userService, null, s3Service, null, userRepo);

    const emailController = new EmailController(emailService, userService, null, null, null, null);

    // Add Google service and controller
    const googleService = new GoogleService(userService, null);
    const googleController = new GoogleController(googleService, s3Service, userRepo);

    const notificationController = new NotificationController(notificationService, userService);
    // Register routes
    this.registerUserRoutes(api, authController, googleController);

    this.registerEmailRoutes(api, emailController);
    this.registerNotificationRoutes(api, notificationController);
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
}
