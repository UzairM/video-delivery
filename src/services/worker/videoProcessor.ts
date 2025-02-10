import ffmpeg from 'fluent-ffmpeg';
import { StorageService, UploadedFile } from '../storage/types';
import path from 'path';
import os from 'os';
import fs from 'fs';

interface ProcessVideoOptions {
  videoId: string;
  inputPath: string;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  title?: string;
  description?: string;
}

interface TranscodeOptions {
  resolution: string;
  bitrate: string;
  maxrate: string;
  bufsize: string;
  profile: string;
  outputPath: string;
  segmentPath: string;
}

// In-memory store for video processing status
export const videoStore = new Map<string, {
  status: 'pending' | 'processing' | 'ready' | 'error';
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  duration?: number;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  timestamp?: string;
}>();

export class VideoProcessor {
  constructor(private storage: StorageService) {}

  private async getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
        });
      });
    });
  }

  private async generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['1'],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '1280x720'
        })
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });
  }

  private generateMasterPlaylist(variants: TranscodeOptions[]): string {
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:7\n';
    playlist += '#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=0.1,CAN-SKIP-UNTIL=12.0,HOLD-BACK=3.0\n';
    playlist += '#EXT-X-INDEPENDENT-SEGMENTS\n\n';
    playlist += '#EXT-X-CONTENT-STEERING:SERVER-URI="steering.json"\n';
    playlist += '#EXT-X-START:TIME-OFFSET=0,PRECISE=YES\n';

    variants.forEach(variant => {
      const [width, height] = variant.resolution.split('x');
      const bandwidthBits = parseInt(variant.bitrate) * 1000;
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthBits},RESOLUTION=${variant.resolution},CODECS="avc1.4d4029,mp4a.40.2",FRAME-RATE=30,SCORE=1.0\n`;
      playlist += `${variant.resolution.split('x')[1]}p/playlist.m3u8\n`;
    });

    return playlist;
  }

  private async transcodeVariant(inputPath: string, options: TranscodeOptions): Promise<void> {
    // Add variant playlist headers
    const variantPlaylistHeaders = [
      '#EXT-X-PLAYLIST-TYPE:EVENT',
      '#EXT-X-TARGETDURATION:1',
      '#EXT-X-VERSION:7',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-INDEPENDENT-SEGMENTS',
      '#EXT-X-MAP:URI="init.mp4"'
    ].join('\n') + '\n';

    await fs.promises.writeFile(
      path.join(options.outputPath, 'playlist_header.m3u8'),
      variantPlaylistHeaders
    );

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('stderr', (stderrLine) => {
          console.log('FFmpeg stderr:', stderrLine);
        })
        .outputOptions([
          `-vf scale=${options.resolution}`,
          '-c:v libx264',
          `-b:v ${options.bitrate}`,
          `-maxrate ${options.maxrate}`,
          `-bufsize ${options.bufsize}`,
          `-profile:v ${options.profile}`,
          '-c:a aac',
          '-b:a 128k',
          '-ac 2',
          '-f hls',
          '-hls_time 1',
          '-hls_list_size 5',
          '-hls_flags independent_segments+program_date_time',
          '-hls_segment_type fmp4',
          '-hls_fmp4_init_filename init.mp4',
          '-hls_segment_filename', path.join(options.outputPath, 'segment%d.fmp4'),
          '-tune zerolatency',
          '-g 30',
          '-sc_threshold 0',
          '-preset ultrafast',
          '-movflags frag_keyframe+empty_moov+default_base_moof',
          '-write_prft 1',
          '-video_track_timescale 90000',
          '-force_key_frames expr:gte(t,n_forced*1)',
          '-refs 1',
          '-x264opts no-mbtree',
          '-profile:v baseline',
          '-level:v 3.0',
          '-copyts',
          '-vsync 0',
          '-start_number 0',
          '-avoid_negative_ts disabled'
        ])
        .output(path.join(options.outputPath, 'playlist.m3u8'))
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }

  async processVideo({ videoId, inputPath }: ProcessVideoOptions): Promise<void> {
    const tempDir = path.join(os.tmpdir(), 'video-processing');
    const videoDir = path.join(tempDir, videoId);
    const thumbnailPath = path.join(tempDir, `${videoId}.jpg`);

    try {
      // Check if input file exists and is readable
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      
      try {
        await fs.promises.access(inputPath, fs.constants.R_OK);
      } catch (e) {
        throw new Error(`Input file not readable: ${inputPath}`);
      }
      
      // Log file info
      const stats = await fs.promises.stat(inputPath);
      console.log('Input file:', {
        path: inputPath,
        size: stats.size,
        permissions: stats.mode
      });

      videoStore.set(videoId, { 
        status: 'processing',
        timestamp: new Date().toISOString()
      });

      // Create temp directories
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
      }

      // Get video metadata
      const metadata = await this.getVideoMetadata(inputPath);

      // Generate thumbnail
      await this.generateThumbnail(inputPath, thumbnailPath);
      const thumbnailKey = `thumbnails/${videoId}.jpg`;
      const { url: thumbnailUrl } = await this.storage.uploadFile(
        {
          fieldname: 'thumbnail',
          originalname: `${videoId}.jpg`,
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: await fs.promises.readFile(thumbnailPath),
          size: (await fs.promises.stat(thumbnailPath)).size,
        },
        thumbnailKey
      );

      // Process video into HLS
      const variants = [
        {
          resolution: '1920x1080',
          bitrate: '6000k',
          maxrate: '6000k',
          bufsize: '12000k',
          profile: 'high',
          outputPath: path.join(videoDir, '1080p'),
          segmentPath: '1080p/segment%d.ts'
        },
        {
          resolution: '1280x720',
          bitrate: '2800k',
          maxrate: '2800k',
          bufsize: '5600k',
          profile: 'main',
          outputPath: path.join(videoDir, '720p'),
          segmentPath: '720p/segment%d.ts'
        },
        {
          resolution: '854x480',
          bitrate: '1400k',
          maxrate: '1400k',
          bufsize: '2800k',
          profile: 'main',
          outputPath: path.join(videoDir, '480p'),
          segmentPath: '480p/segment%d.ts'
        },
        {
          resolution: '640x360',
          bitrate: '800k',
          maxrate: '800k',
          bufsize: '1600k',
          profile: 'baseline',
          outputPath: path.join(videoDir, '360p'),
          segmentPath: '360p/segment%d.ts'
        },
        {
          resolution: '426x240',
          bitrate: '400k',
          maxrate: '400k',
          bufsize: '800k',
          profile: 'baseline',
          outputPath: path.join(videoDir, '240p'),
          segmentPath: '240p/segment%d.ts'
        }
      ];

      // Create output directories for each variant
      for (const variant of variants) {
        if (!fs.existsSync(variant.outputPath)) {
          fs.mkdirSync(variant.outputPath, { recursive: true });
        }
      }

      // Process each variant
      await Promise.all(variants.map(variant => this.transcodeVariant(inputPath, variant)));

      // Generate master playlist
      const masterPlaylist = this.generateMasterPlaylist(variants);
      fs.writeFileSync(path.join(videoDir, 'master.m3u8'), masterPlaylist);

      // Upload all HLS files
      const hlsFiles = await this.uploadHLSFiles(videoDir, videoId);
      const masterPlaylistUrl = hlsFiles.find(f => f.key.endsWith('master.m3u8'))?.url;

      if (!masterPlaylistUrl) {
        throw new Error('Failed to get master playlist URL');
      }

      // Update video status
      videoStore.set(videoId, {
        status: 'ready',
        url: masterPlaylistUrl,
        thumbnailUrl,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        timestamp: new Date().toISOString(),
        title: metadata.title,
        description: metadata.description
      });

    } catch (error) {
      console.error('Error processing video:', error);
      videoStore.set(videoId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(videoDir)) {
          fs.rmSync(videoDir, { recursive: true, force: true });
        }
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      } catch (error) {
        console.error('Error cleaning up temp files:', error);
      }
    }
  }

  private async uploadHLSFiles(videoDir: string, videoId: string): Promise<Array<{ key: string; url: string }>> {
    const files: Array<{file: UploadedFile; key: string}> = [];
    const baseKey = `videos/${videoId}`;

    const prepareFile = async (localPath: string, relativePath: string) => {
      files.push({
        file: {
          fieldname: 'video',
          originalname: path.basename(localPath),
          encoding: '7bit',
          mimetype: this.getMimeType(localPath),
          buffer: await fs.promises.readFile(localPath),
          size: (await fs.promises.stat(localPath)).size,
        },
        key: `${baseKey}/${relativePath}`
      });
    };

    // Prepare master playlist
    await prepareFile(
      path.join(videoDir, 'master.m3u8'),
      'master.m3u8'
    );

    // Prepare variant files
    const variants = ['1080p', '720p', '480p', '360p', '240p'];
    for (const variant of variants) {
      const variantDir = path.join(videoDir, variant);
      if (!fs.existsSync(variantDir)) continue;

      const variantFiles = fs.readdirSync(variantDir);
      for (const file of variantFiles) {
        await prepareFile(
          path.join(variantDir, file),
          `${variant}/${file}`
        );
      }
    }

    // Batch upload all files
    return this.storage.uploadBatch(files);
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.m3u8':
        return 'application/vnd.apple.mpegurl';
      case '.fmp4':
        return 'video/mp4';
      case '.mp4':
        return 'video/mp4';
      default:
        return 'application/octet-stream';
    }
  }
} 