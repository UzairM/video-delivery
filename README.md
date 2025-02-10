# Video Processing Service

A high-performance video processing service that converts uploaded videos into HTTP Live Streaming (HLS) format with low-latency optimizations.

This service handles:
- Video upload and storage in S3
- Video transcoding to HLS format with multiple quality variants
- Thumbnail generation
- CloudFront CDN integration
- Video status tracking

## Features

- **Video Processing**
  - Multi-bitrate HLS encoding (240p to 1080p)
  - Low-latency optimizations (2-3 second latency)
  - Adaptive bitrate streaming
  - Thumbnail generation
  - FFmpeg hardware acceleration support
- **Low-Latency HLS streaming (LL-HLS)**
  - Partial segment delivery
  - HTTP/2 PUSH support
  - In-memory video status tracking

- **Storage**
  - S3-compatible storage backend
  - CloudFront CDN integration
  - Efficient caching strategies
  - CORS support

- **Playback**
  - HLS.js player with low-latency mode
  - Quality selection
  - Automatic bitrate adaptation
  - Real-time playback statistics
  - Error recovery
  - Safari native HLS fallback

## Prerequisites

- AWS account with S3 and CloudFront set up
  - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html
  - Get the CloudFront domain name and IAM Access Key ID and Secret Access Key
- Node.js 18+
- FFmpeg installed on the system
- Docker and Docker Compose (optional)

## Quick Start

1. Clone the repository
2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Start with Docker:
```bash
docker compose up -d
```

4. Access the dashboard at `http://localhost:3000/videos.html`

## Environment Variables

```env
PORT=3000
API_DOMAIN=http://localhost:3000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
CLOUDFRONT_DOMAIN=your_cloudfront_domain

# Processing
MAX_FILE_SIZE=104857600 # 100MB in bytes
ALLOWED_VIDEO_TYPES=all
# or specify formats: video/mp4,video/quicktime,video/avi,video/mkv,video/webm,video/wmv,video/flv,video/3gp,video/mpeg
```

## Docker Support

The service includes Docker support with:
- Multi-stage build for smaller images
- FFmpeg pre-installed
- Development mode with hot reload
- Volume mounts for local development

### Docker Commands

```bash
# Build and start services
docker compose up -d

# View logs
docker compose logs -f

# Rebuild after changes
docker compose up -d --build

# Stop services
docker compose down

# Remove volumes and containers
docker compose down -v

# Check container status
docker compose ps

# Execute command in container
docker compose exec video-service sh
```

## API Endpoints

### POST /api/videos/upload
Upload a new video file with optional metadata.

**Body (multipart/form-data):**
- `video`: Video file
- `title`: Video title (optional)
- `description`: Video description (optional)

**Success Response (200 OK):**
```json
{
  "id": "video_id",
  "status": "pending",
  "expectedUrls": {
    "video": "https://cdn.example.com/videos/video_id/master.m3u8",
    "thumbnail": "https://cdn.example.com/thumbnails/video_id.jpg"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Invalid file type. Supported types: video/mp4,video/quicktime..."
}
```

**Error Response (413 Payload Too Large):**
```json
{
  "error": "File too large. Maximum size: 100MB"
}
```

### GET /api/videos/list
Get all videos grouped by their processing status.

**Success Response (200 OK):**
```json
{
  "total": 10,
  "videos": {
    "ready": [
      {
        "id": "video_id",
        "status": "ready",
        "url": "https://cdn.example.com/videos/video_id/master.m3u8",
        "thumbnailUrl": "https://cdn.example.com/thumbnails/video_id.jpg",
        "title": "My Video",
        "description": "Video description",
        "duration": 120.5,
        "width": 1920,
        "height": 1080,
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ],
    "processing": [
      {
        "id": "video_id",
        "status": "processing",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pending": [
      {
        "id": "video_id",
        "status": "pending",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ],
    "error": [
      {
        "id": "video_id",
        "status": "error",
        "error": "Processing failed: Invalid video format",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### GET /api/videos/:id/status
Get status of a specific video.

**Success Response (200 OK):**
```json
{
  "id": "video_id",
  "status": "ready",
  "url": "https://cdn.example.com/videos/video_id/master.m3u8",
  "thumbnailUrl": "https://cdn.example.com/thumbnails/video_id.jpg",
  "title": "My Video",
  "description": "Video description",
  "duration": 120.5,
  "width": 1920,
  "height": 1080,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Video not found"
}
```

### GET /health
Check service health status.

**Success Response (200 OK):**
```json
{
  "status": "ok"
}
```

## Video Processing Pipeline

1. Video upload
2. Metadata extraction
3. Thumbnail generation
4. Multi-bitrate transcoding
5. HLS packaging
6. CDN distribution

### Detailed Flow

1. Client uploads video through `/api/videos/upload`
2. Original video stored in S3 (`uploads/{id}/original.mp4`)
3. Worker service picks up pending videos
4. Video processing:
   - Generates thumbnail
   - Transcodes to multiple HLS variants
   - Uploads processed files to S3
   - Updates video status
5. Final files available through CloudFront CDN

## Supported Video Formats

- MP4 (.mp4, .m4v)
- QuickTime (.mov)
- AVI (.avi)
- MKV (.mkv)
- WebM (.webm)
- WMV (.wmv)
- FLV (.flv)
- 3GP (.3gp)
- MPEG (.mpeg, .mpg)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## CloudFront Setup

Required CloudFront settings for optimal performance:

- Origin Shield: Enabled
- HTTP/3: Enabled
- CORS: Enabled
- Compression: Enabled
- Cache Policy: Optimized for video
- Origin Request Policy: CORS-enabled

## Performance Optimizations

- Low-latency HLS configuration
- Adaptive bitrate streaming
- HTTP/2 push hints
- Efficient segment caching
- Automatic quality adaptation
- Error recovery strategies

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT 