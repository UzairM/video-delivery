import { StorageService, StorageConfig } from './types';
import { S3StorageService } from './s3Storage';

export function createStorageService(config: StorageConfig): StorageService {
  return new S3StorageService(config);
}

export const storageService = createStorageService({
  bucket: process.env.S3_BUCKET_NAME,
  region: process.env.AWS_REGION,
  accessKey: process.env.AWS_ACCESS_KEY_ID,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY,
  useSSL: true,
  cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN,
}); 