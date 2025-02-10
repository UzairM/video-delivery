import { VideoProcessor, videoStore } from './videoProcessor';
import { StorageService } from '../storage/types';
import path from 'path';
import os from 'os';
import fs from 'fs';

export class WorkerService {
  private processor: VideoProcessor;
  private isProcessing = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(private storage: StorageService) {
    this.processor = new VideoProcessor(storage);
  }

  start(intervalMs = 5000): void {
    if (this.pollInterval) return;
    
    this.pollInterval = setInterval(async () => {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      try {
        while (await this.processNextVideo()) {
          // Continue processing next video
        }
      } finally {
        this.isProcessing = false;
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async processNextVideo(): Promise<boolean> {
    try {
      // Find next pending video
      let pendingVideoId: string | undefined;
      for (const [id, data] of videoStore.entries()) {
        if (data.status === 'pending') {
          pendingVideoId = id;
          break;
        }
      }

      if (!pendingVideoId) return false;

      const tempDir = path.join(os.tmpdir(), 'video-processing');
      const inputPath = path.join(tempDir, `${pendingVideoId}-input.mp4`);

      try {
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        console.log('Processing video:', pendingVideoId);

        // Download original video
        const originalFile = await this.storage.downloadFile(`uploads/${pendingVideoId}/original.mp4`);
        await fs.promises.writeFile(inputPath, originalFile);

        // Process video
        await this.processor.processVideo({
          videoId: pendingVideoId,
          inputPath,
        });

        console.log('Video processed successfully:', pendingVideoId);

        // Delete original file
        await this.storage.deleteFile(`uploads/${pendingVideoId}/original.mp4`);
        return true;
      } catch (error) {
        console.error('Error processing video:', error);
        videoStore.set(pendingVideoId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return true; // Continue to next video even if this one failed
      } finally {
        // Cleanup temp files
        try {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        } catch (error) {
          console.error('Error cleaning up temp file:', error);
        }
      }
    } catch (error) {
      console.error('Error in processNextVideo:', error);
      return false;
    }
  }
} 