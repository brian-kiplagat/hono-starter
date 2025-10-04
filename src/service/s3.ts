import { MediaConvert } from '@aws-sdk/client-mediaconvert';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';

import env from '../lib/env.js';

/**
 * Service class for managing AWS S3 operations including file uploads, downloads, and URL generation
 */
export class S3Service {
  private client: S3Client;
  private mediaConvertClient: MediaConvert;
  private bucket: string;

  /**
   * Creates an instance of S3Service
   * Initializes AWS S3 client with credentials from environment variables
   */
  constructor() {
    this.client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });

    this.mediaConvertClient = new MediaConvert({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });

    this.bucket = env.S3_BUCKET_NAME;
  }

  /**
   * Generates a presigned URL for uploading a file to S3
   * @param {string} key - The S3 object key (file path)
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<{presignedUrl: string, url: string}>} Presigned URL for upload and final S3 URL
   */
  async generatePresignedUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.client, command, {
      expiresIn: 3600, // URL expires in 1 hour
    });

    return {
      presignedUrl,
      url: `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

  /**
   * Generates a presigned URL for downloading/viewing a file from S3
   * @param {string} key - The S3 object key (file path)
   * @param {string} contentType - MIME type of the file
   * @param {number} [expiresIn=3600] - URL expiration time in seconds
   * @returns {Promise<string>} Presigned URL for downloading/viewing
   */
  async generateGetUrl(key: string, contentType: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn,
    });
  }

  /**
   * Deletes an object from S3
   * @param {string} key - The S3 object key (file path) to delete
   * @returns {Promise<void>}
   */
  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Copies an object within the same S3 bucket
   * @param {string} sourceKey - The source object key
   * @param {string} destinationKey - The destination object key
   * @returns {Promise<void>}
   */
  async copyObject(sourceKey: string, destinationKey: string) {
    const encodedSourceKey = encodeURIComponent(sourceKey);
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${encodedSourceKey}`,
      Key: destinationKey,
    });

    await this.client.send(command);
  }

  /**
   * Uploads a file directly to S3
   * @param {string} key - The S3 object key (file path)
   * @param {string|Buffer|Readable} content - The file content to upload
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<string>} The URL of the uploaded file
   */
  async uploadFile(key: string, content: string | Buffer | Readable, contentType: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    await this.client.send(command);
    return `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Initiates a multipart upload to S3
   * @param {string} key - The S3 object key (file path)
   * @param {string} contentType - MIME type of the file
   * @returns {Promise<{uploadId: string, url: string}>} Upload ID and final S3 URL
   */
  async initiateMultipartUpload(key: string, contentType: string) {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const response = await this.client.send(command);
    return {
      uploadId: response.UploadId!,
      url: `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

  /**
   * Generates a presigned URL for uploading a part in a multipart upload
   * @param {string} key - The S3 object key (file path)
   * @param {string} uploadId - The multipart upload ID
   * @param {number} partNumber - The part number (1-based)
   * @returns {Promise<string>} Presigned URL for uploading the part
   */
  async generateMultipartPresignedUrl(key: string, uploadId: string, partNumber: number) {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: 3600, // URL expires in 1 hour
    });
  }

  /**
   * Completes a multipart upload
   * @param {string} key - The S3 object key (file path)
   * @param {string} uploadId - The multipart upload ID
   * @param {Array<{ETag: string, PartNumber: number}>} parts - Array of uploaded parts with their ETags
   * @returns {Promise<void>}
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ ETag: string; PartNumber: number }>,
  ) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    await this.client.send(command);
  }

  /**
   * Aborts a multipart upload
   * @param {string} key - The S3 object key (file path)
   * @param {string} uploadId - The multipart upload ID
   * @returns {Promise<void>}
   */
  async abortMultipartUpload(key: string, uploadId: string) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });

    await this.client.send(command);
  }

  /**
   * Creates a MediaConvert job for HLS conversion
   * @param {string} s3Key - The S3 object key (file path) to convert
   * @param {string} [roleArn] - IAM role ARN for MediaConvert (optional, uses default if not provided)
   * @param {string} [jobTemplate] - Job template name (optional, uses default if not provided)
   * @returns {Promise<{jobId: string, status: string}>} MediaConvert job ID and status
   */
  async createMediaConvertJob(
    s3Key: string,
    roleArn?: string,
    jobTemplate?: string,
  ): Promise<{ jobId: string; status: string }> {
    const inputUrl = `s3://${this.bucket}/${s3Key}`;

    const jobParams = {
      Role: roleArn || 'arn:aws:iam::897729107116:role/HLSPreProcessor',
      Settings: {
        Inputs: [
          {
            FileInput: inputUrl,
          },
        ],
      },
      JobTemplate: jobTemplate || 'HLS_MultiResolution_Template',
    };

    try {
      const response = await this.mediaConvertClient.createJob(jobParams);

      return {
        jobId: response.Job?.Id || '',
        status: response.Job?.Status || 'SUBMITTED',
      };
    } catch (error) {
      throw new Error(
        `Failed to create MediaConvert job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets the status of a MediaConvert job
   * @param {string} jobId - The MediaConvert job ID
   * @returns {Promise<{status: string, progress?: number, currentPhase?: string}>} Job status and progress info
   */
  async getMediaConvertJobStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    currentPhase?: string;
  }> {
    try {
      const response = await this.mediaConvertClient.getJob({ Id: jobId });

      return {
        status: response.Job?.Status || 'UNKNOWN',
        progress: response.Job?.JobPercentComplete,
        currentPhase: response.Job?.CurrentPhase,
      };
    } catch (error) {
      throw new Error(
        `Failed to get MediaConvert job status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Cancels a MediaConvert job
   * @param {string} jobId - The MediaConvert job ID
   * @returns {Promise<void>}
   */
  async cancelMediaConvertJob(jobId: string): Promise<void> {
    try {
      await this.mediaConvertClient.cancelJob({ Id: jobId });
    } catch (error) {
      throw new Error(
        `Failed to cancel MediaConvert job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Lists MediaConvert jobs with optional filtering
   * @param {string} [status] - Filter by job status (optional)
   * @param {number} [maxResults] - Maximum number of jobs to return (optional, default 50)
   * @returns {Promise<Array<{jobId: string, status: string, createdAt: Date}>>} List of MediaConvert jobs
   */
  async listMediaConvertJobs(
    status?: string,
    maxResults: number = 50,
  ): Promise<Array<{ jobId: string; status: string; createdAt: Date }>> {
    try {
      const params: any = { MaxResults: maxResults };
      if (status) {
        params.Status = status;
      }

      const response = await this.mediaConvertClient.listJobs(params);

      return (response.Jobs || []).map((job) => ({
        jobId: job.Id || '',
        status: job.Status || 'UNKNOWN',
        createdAt: job.CreatedAt || new Date(),
      }));
    } catch (error) {
      throw new Error(
        `Failed to list MediaConvert jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
