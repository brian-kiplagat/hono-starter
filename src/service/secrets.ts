import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';

/**
 * Service class for managing AWS Secrets Manager operations
 */
export class SecretsManagerService {
  private client: SecretsManagerClient;
  private readonly secretName: string;
  private cachedSecrets: Record<string, string> | null = null;
  private lastFetchTime: number = 0;
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Creates an instance of SecretsManagerService
   * Initializes AWS Secrets Manager client with credentials from environment
   */
  constructor() {
    this.client = new SecretsManagerClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });
    this.secretName = 'prod/elevnt.io';
  }

  /**
   * Fetches secrets from AWS Secrets Manager
   * @returns {Promise<Record<string, any>>} Parsed secrets object
   * @throws {Error} When secret retrieval fails
   */
  private async fetchSecrets(): Promise<Record<string, string>> {
    try {
      const response = await this.client.send(
        new GetSecretValueCommand({
          SecretId: this.secretName,
          VersionStage: 'AWSCURRENT',
        }),
      );

      if (!response.SecretString) {
        throw new Error('Secret string is empty or undefined');
      }

      return JSON.parse(response.SecretString);
    } catch (error) {
      logger.error('Failed to fetch secrets from AWS Secrets Manager:', error);
      throw error;
    }
  }

  /**
   * Gets secrets with caching support
   * @returns {Promise<Record<string, any>>} Cached or fresh secrets
   */
  private async getSecrets(): Promise<Record<string, string>> {
    const now = Date.now();

    // Return cached secrets if still valid
    if (this.cachedSecrets && now - this.lastFetchTime < this.cacheDuration) {
      return this.cachedSecrets;
    }

    // Fetch fresh secrets
    this.cachedSecrets = await this.fetchSecrets();
    this.lastFetchTime = now;

    return this.cachedSecrets;
  }

  /**
   * Gets a specific secret value
   * @param {string} key - The secret key to retrieve
   * @returns {Promise<string>} The secret value
   * @throws {Error} When secret retrieval fails or key doesn't exist
   */
  public async getSecret(key: string): Promise<string> {
    const secrets = await this.getSecrets();

    if (!(key in secrets)) {
      throw new Error(`Secret key '${key}' not found in AWS Secrets Manager`);
    }

    return secrets[key];
  }

  /**
   * Gets all secrets as a flat object
   * @returns {Promise<Record<string, string>>} All secrets
   */
  public async getAllSecrets(): Promise<Record<string, string>> {
    const secrets = await this.getSecrets();
    return secrets;
  }

  /**
   * Clears the cached secrets, forcing a fresh fetch on next request
   */
  public clearCache(): void {
    this.cachedSecrets = null;
    this.lastFetchTime = 0;
  }
}

// Export a singleton instance
export const secretsManager = new SecretsManagerService();
