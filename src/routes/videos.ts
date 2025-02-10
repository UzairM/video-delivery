import { Router, Response, Request } from 'express';
import { randomBytes } from 'crypto';
import { uploadMiddleware } from '../middleware/upload';
import { storageService } from '../services/storage';
import { WorkerService } from '../services/worker';
import { videoStore } from '../services/worker/videoProcessor';

const router = Router();
const workerService = new WorkerService(storageService);

// Start the worker service
workerService.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  workerService.stop();
  process.exit(0);
});

function generateId(): string {
  return randomBytes(12).toString('hex');
}

function getExpectedUrls(videoId: string) {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  return {
    video: `https://${domain}/videos/${videoId}/master.m3u8`,
    thumbnail: `https://${domain}/thumbnails/${videoId}.jpg`,
    variants: {
      '1080p': `https://${domain}/videos/${videoId}/1080p/playlist.m3u8`,
      '720p': `https://${domain}/videos/${videoId}/720p/playlist.m3u8`,
      '480p': `https://${domain}/videos/${videoId}/480p/playlist.m3u8`,
      '360p': `https://${domain}/videos/${videoId}/360p/playlist.m3u8`,
      '240p': `https://${domain}/videos/${videoId}/240p/playlist.m3u8`,
    }
  };
}

router.get('/list', (_req: Request, res: Response) => {
  try {
    const videos = {
      ready: [] as any[],
      processing: [] as any[],
      pending: [] as any[],
      error: [] as any[]
    };

    // Group videos by status
    for (const [id, data] of videoStore.entries()) {
      const videoInfo = {
        id,
        title: data.title,
        description: data.description,
        timestamp: data.timestamp,
        ...getExpectedUrls(id)
      };

      switch (data.status) {
        case 'ready':
          videos.ready.push({
            ...videoInfo,
            url: data.url,
            thumbnailUrl: data.thumbnailUrl,
            duration: data.duration,
            width: data.width,
            height: data.height
          });
          break;
        case 'processing':
          videos.processing.push(videoInfo);
          break;
        case 'pending':
          videos.pending.push(videoInfo);
          break;
        case 'error':
          videos.error.push({
            ...videoInfo,
            error: data.error
          });
          break;
      }
    }

    // Sort each group by timestamp
    for (const status of Object.keys(videos)) {
      videos[status as keyof typeof videos].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    res.json({
      total: videoStore.size,
      videos
    });
  } catch (error) {
    console.error('List videos error:', error);
    res.status(500).json({
      message: 'Failed to list videos',
      code: 'video/server-error'
    });
  }
});

router.post('/upload', (req: Request, res: Response) => {
  uploadMiddleware(req, res, ((err: unknown) => {
    (async () => {
      try {
        if (err) {
          res.status(400).json({ 
            message: err instanceof Error ? err.message : 'Upload error',
            code: 'upload/invalid-file'
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({ 
            message: 'No file uploaded',
            code: 'upload/no-file'
          });
          return;
        }

        const fileId = generateId();
        const originalKey = `uploads/${fileId}/original.mp4`;
        const expectedUrls = getExpectedUrls(fileId);

        // Upload original file to storage
        await storageService.uploadFile(req.file, originalKey);

        // Initialize video status
        videoStore.set(fileId, {
          status: 'pending',
          title: req.body.title || 'Untitled',
          description: req.body.description || '',
          timestamp: new Date().toISOString()
        });

        res.status(201).json({
          id: fileId,
          status: 'pending',
          expectedUrls
        });
      } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
          message: 'Failed to upload video',
          code: 'upload/server-error'
        });
      }
    })();
  }));
});

router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const videoData = videoStore.get(req.params.id);
    
    if (!videoData) {
      res.status(404).json({
        message: 'Video not found',
        code: 'video/not-found'
      });
      return;
    }

    res.json({
      id: req.params.id,
      status: videoData.status,
      url: videoData.url,
      thumbnailUrl: videoData.thumbnailUrl,
      error: videoData.error
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      message: 'Failed to check video status',
      code: 'video/server-error'
    });
  }
});

export default router; 