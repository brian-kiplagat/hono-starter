# AWS Secrets Manager Integration

This project now integrates with AWS Secrets Manager to securely store and retrieve sensitive configuration values like API keys, database credentials, and other secrets.

## Overview

The integration includes:

1. **SecretsManagerService** - A service class that handles fetching secrets from AWS Secrets Manager
2. **Updated StripeService** - Now uses AWS Secrets Manager instead of environment variables
3. **Caching** - Secrets are cached for 5 minutes to reduce API calls
4. **Error Handling** - Comprehensive error handling for secret retrieval failures

## Setup

### 1. Install Dependencies

```bash
pnpm add @aws-sdk/client-secrets-manager
```

### 2. Configure AWS Credentials

Ensure your AWS credentials are properly configured in your environment:

```bash
export AWS_REGION=eu-west-2
export AWS_ACCESS_KEY=your_access_key
export AWS_SECRET_KEY=your_secret_key
```

### 3. Store Secrets in AWS Secrets Manager

Create a secret in AWS Secrets Manager with the name `prod/elevnt.io` containing a JSON object with your secrets:

```json
{
  "STRIPE_LIVE_SECRET_KEY": "sk_live_...",
  "STRIPE_LIVE_PUBLISHABLE_KEY": "pk_live_...",
  "STRIPE_LIVE_WEBHOOK_SECRET": "whsec_...",
  "STRIPE_LIVE_CLIENT_ID": "ca_...",
  "STRIPE_TEST_SECRET_KEY": "sk_test_...",
  "STRIPE_TEST_PUBLISHABLE_KEY": "pk_test_...",
  "STRIPE_TEST_WEBHOOK_SECRET": "whsec_...",
  "STRIPE_TEST_CLIENT_ID": "ca_...",
  "STRIPE_OAUTH_REDIRECT_URI": "https://your-domain.com/stripe/oauth/callback",
  "DB_PASSWORD": "your_db_password",
  "BREVO_API_KEY": "your_brevo_api_key",
  "TURNSTILE_SECRET_KEY": "your_turnstile_secret",
  "GOOGLE_CLIENT_SECRET": "your_google_client_secret"
}
```

## Usage

### Using the SecretsManagerService

```typescript
import { secretsManager } from './service/secrets.js';

// Get a specific secret
const stripeKey = await secretsManager.getSecret('STRIPE_LIVE_SECRET_KEY');

// Get all secrets
const allSecrets = await secretsManager.getAllSecrets();

// Clear cache (useful for testing or when secrets are updated)
secretsManager.clearCache();
```

### Using the Updated StripeService

The StripeService now automatically initializes with secrets from AWS Secrets Manager:

```typescript
import { StripeService } from './service/stripe.js';

const stripeService = new StripeService();
await stripeService.initialize(); // This fetches secrets from AWS

// Now you can use the service normally
const customer = await stripeService.createCustomer('user@example.com');
```

## Benefits

1. **Security** - Secrets are not stored in environment variables or code
2. **Centralized Management** - All secrets are managed in one place
3. **Version Control** - AWS Secrets Manager supports versioning
4. **Access Control** - Fine-grained IAM permissions for secret access
5. **Audit Trail** - AWS CloudTrail logs all secret access
6. **Automatic Rotation** - AWS can automatically rotate secrets

## Migration from Environment Variables

The following environment variables are now fetched from AWS Secrets Manager:

- `STRIPE_LIVE_SECRET_KEY`
- `STRIPE_LIVE_PUBLISHABLE_KEY`
- `STRIPE_LIVE_WEBHOOK_SECRET`
- `STRIPE_LIVE_CLIENT_ID`
- `STRIPE_TEST_SECRET_KEY`
- `STRIPE_TEST_PUBLISHABLE_KEY`
- `STRIPE_TEST_WEBHOOK_SECRET`
- `STRIPE_TEST_CLIENT_ID`
- `STRIPE_OAUTH_REDIRECT_URI`

## Error Handling

The service includes comprehensive error handling:

- **Secret Not Found** - Throws error if requested secret doesn't exist
- **AWS API Errors** - Handles network issues, authentication failures, etc.
- **Invalid JSON** - Handles malformed secret values
- **Cache Failures** - Falls back to fresh fetch if cache is corrupted

## Caching

Secrets are cached for 5 minutes to:

- Reduce AWS API calls
- Improve performance
- Reduce costs

The cache is automatically invalidated when:

- Cache duration expires
- `clearCache()` is called
- Service is restarted

## Development vs Production

The service automatically uses the correct secrets based on the `NODE_ENV` environment variable:

- **Development**: Uses test Stripe keys
- **Production**: Uses live Stripe keys

## Monitoring

Monitor secret access through:

- AWS CloudTrail logs
- Application logs (check for "Stripe service initialized" messages)
- AWS Secrets Manager console

## Security Best Practices

1. **Least Privilege** - Use IAM roles with minimal required permissions
2. **Secret Rotation** - Regularly rotate secrets stored in AWS
3. **Access Logging** - Enable CloudTrail for audit purposes
4. **Network Security** - Use VPC endpoints for AWS API calls in production
5. **Encryption** - All secrets are encrypted at rest by AWS

## Troubleshooting

### Common Issues

1. **Authentication Errors**

   - Verify AWS credentials are correct
   - Check IAM permissions for Secrets Manager

2. **Secret Not Found**

   - Verify secret name is correct (`prod/elevnt.io`)
   - Check secret exists in the correct AWS region

3. **Network Issues**

   - Verify network connectivity to AWS
   - Check VPC configuration if using private subnets

4. **Cache Issues**
   - Call `secretsManager.clearCache()` to force refresh
   - Restart the application

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in your environment.
