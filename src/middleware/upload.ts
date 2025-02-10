import multer from 'multer';
import { Request } from 'express';
import 'multer';

const DEFAULT_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/3gpp',
  'video/x-m4v',
  'video/mpeg'
];

const ALLOWED_MIME_TYPES = process.env.ALLOWED_VIDEO_TYPES === 'all' 
  ? DEFAULT_VIDEO_TYPES 
  : (process.env.ALLOWED_VIDEO_TYPES?.split(',') || DEFAULT_VIDEO_TYPES);

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10); // 100MB default

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // If set to 'all', accept any video/* MIME type
  if (process.env.ALLOWED_VIDEO_TYPES === 'all' && file.mimetype.startsWith('video/')) {
    cb(null, true);
    return;
  }

  // Otherwise check against allowed types
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error('Invalid file type. Only supported video formats are allowed.'));
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
}).single('video'); 