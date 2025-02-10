export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface StorageService {
  uploadFile(
    file: UploadedFile,
    key: string
  ): Promise<{ url: string }>;
  
  downloadFile(key: string): Promise<Buffer>;
  
  deleteFile(key: string): Promise<void>;
  
  getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
  } | null>;

  getCloudFrontUrl(key: string): string;
}

export interface StorageConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  cloudFrontDomain: string;
} 