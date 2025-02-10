/// <reference types="node" />
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { StorageService, StorageConfig, UploadedFile } from './types';

interface UploadOptions {
  cacheControl?: string;
  contentType?: string;
  acl?: string;
  corsHeaders?: {
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
  };
}

export class S3StorageService implements StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private cloudFrontDomain: string;

  constructor(config: StorageConfig) {
    this.s3Client = new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: false,
      useAccelerateEndpoint: false
    });
    this.bucket = config.bucket;
    this.cloudFrontDomain = config.cloudFrontDomain;
  }

  private getUploadOptions(key: string): UploadOptions {
    if (key.endsWith('.m3u8')) {
      return {
        cacheControl: 'max-age=1, stale-while-revalidate=2',
        contentType: 'application/vnd.apple.mpegurl',
        corsHeaders: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD',
          'Access-Control-Allow-Headers': '*'
        }
      };
    }
    
    if (key.endsWith('.fmp4') || key.endsWith('init.mp4')) {
      return {
        cacheControl: 'max-age=31536000, immutable',
        contentType: 'video/mp4',
        corsHeaders: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD',
          'Access-Control-Allow-Headers': '*'
        }
      };
    }

    return {
      cacheControl: 'public, max-age=31536000',
    };
  }

  async uploadFile(file: UploadedFile, key: string): Promise<{ url: string }> {
    try {
      const options = this.getUploadOptions(key);
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: options.contentType || file.mimetype,
        CacheControl: options.cacheControl,
        ...options.corsHeaders && {
          Metadata: {
            ...options.corsHeaders
          }
        },
        // Enable HTTP/2 PUSH hints
        Metadata: {
          'x-amz-mp-parts-count': key.endsWith('.m3u8') ? '1' : undefined,
          'x-amz-mp-parts': key.endsWith('.m3u8') ? JSON.stringify([
            { path: key.replace('playlist.m3u8', 'init.mp4') },
            { path: key.replace('playlist.m3u8', 'segment0.fmp4') }
          ]) : undefined
        }
      }));

      return { url: this.getCloudFrontUrl(key) };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error('Failed to upload file');
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));

      const chunks: Buffer[] = [];
      const stream = response.Body as Readable;
      
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('S3 download error:', error);
      throw new Error('Failed to download file');
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error('Failed to delete file');
    }
  }

  async getFileMetadata(key: string): Promise<{ size: number; contentType: string; lastModified: Date; } | null> {
    try {
      const response = await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
      };
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  getCloudFrontUrl(key: string): string {
    return `https://${this.cloudFrontDomain}/${key}`;
  }

  async uploadBatch(files: Array<{file: UploadedFile; key: string}>): Promise<Array<{ key: string; url: string }>> {
    // Batch upload for better performance with many small segments
    return Promise.all(
      files.map(async ({file, key}) => {
        const result = await this.uploadFile(file, key);
        return { key, url: result.url };
      })
    );
  }
} 