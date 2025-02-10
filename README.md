# Video Upload Service

A microservice for handling video uploads, processing, and streaming. This service handles:
- Video upload and storage in S3
- Video transcoding to HLS format with multiple quality variants (240p to 1080p)
- Thumbnail generation
- CloudFront CDN integration
- Video status tracking

## Features

- Supports MP4 and MOV video formats
- Generates HLS streams in multiple qualities (240p to 1080p)
- Automatic thumbnail generation
- Progress tracking and status updates
- CloudFront CDN integration for fast video delivery
- In-memory video status tracking

## Prerequisites

- Node.js 18+
- FFmpeg installed on the system
- AWS account with S3 and CloudFront set up
- Docker and Docker Compose (optional)

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
PORT=3001
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
CLOUDFRONT_DOMAIN=your_cloudfront_domain

# Processing
MAX_FILE_SIZE=104857600 # 100MB in bytes
ALLOWED_VIDEO_TYPES=video/mp4,video/quicktime
```

## Quick Start with Docker

```bash
# Start the service
docker-compose up

# Start in background
docker-compose up -d
```

## Manual Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the service
npm start

# For development with hot reload
npm run dev
```

## API Endpoints

### POST /api/videos/upload
Upload a new video file.

**Body (multipart/form-data):**
- `video`: Video file (MP4/MOV)
- `title`: Video title (optional)
- `description`: Video description (optional)

**Response:**
```json
{
  "id": "video_id",
  "status": "pending",
  "expectedUrls": {
    "video": "https://cdn.example.com/videos/video_id/master.m3u8",
    "thumbnail": "https://cdn.example.com/thumbnails/video_id.jpg",
    "variants": {
      "1080p": "https://cdn.example.com/videos/video_id/1080p/playlist.m3u8",
      "720p": "https://cdn.example.com/videos/video_id/720p/playlist.m3u8",
      "480p": "https://cdn.example.com/videos/video_id/480p/playlist.m3u8",
      "360p": "https://cdn.example.com/videos/video_id/360p/playlist.m3u8",
      "240p": "https://cdn.example.com/videos/video_id/240p/playlist.m3u8"
    }
  }
}
```

### GET /api/videos/list
Get all videos grouped by their processing status.

**Response:**
```json
{
  "total": 10,
  "videos": {
    "ready": [
      {
        "id": "video_id",
        "title": "Video Title",
        "description": "Description",
        "timestamp": "2024-02-10T20:00:00.000Z",
        "video": "https://cdn.example.com/videos/video_id/master.m3u8",
        "thumbnail": "https://cdn.example.com/thumbnails/video_id.jpg",
        "variants": {
          "1080p": "https://cdn.example.com/videos/video_id/1080p/playlist.m3u8",
          "720p": "https://cdn.example.com/videos/video_id/720p/playlist.m3u8",
          "480p": "https://cdn.example.com/videos/video_id/480p/playlist.m3u8",
          "360p": "https://cdn.example.com/videos/video_id/360p/playlist.m3u8",
          "240p": "https://cdn.example.com/videos/video_id/240p/playlist.m3u8"
        },
        "url": "actual_url",
        "thumbnailUrl": "actual_thumbnail_url",
        "duration": 120,
        "width": 1920,
        "height": 1080
      }
    ],
    "processing": [...],
    "pending": [...],
    "error": [...]
  }
}
```

### GET /api/videos/:id/status
Get video processing status.

**Response:**
```json
{
  "id": "video_id",
  "status": "ready",
  "url": "https://cdn.example.com/videos/video_id/master.m3u8",
  "thumbnailUrl": "https://cdn.example.com/thumbnails/video_id.jpg",
  "error": null
}
```

## Video Processing Flow

1. Client uploads video through `/api/videos/upload`
2. Original video stored in S3 (`uploads/{id}/original.mp4`)
3. Worker service picks up pending videos
4. Video processing:
   - Generates thumbnail
   - Transcodes to multiple HLS variants (240p to 1080p)
   - Uploads processed files to S3
   - Updates video status
5. Final files available through CloudFront CDN

## Error Handling

The service includes comprehensive error handling:
- File validation (size, type)
- Processing errors
- Storage errors
- Invalid requests

All errors return appropriate HTTP status codes and error messages.

## Development

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Docker Support

The service includes Docker support with:
- Multi-stage build for smaller images
- FFmpeg pre-installed
- Development mode with hot reload
- Volume mounts for local development

See `Dockerfile` and `docker-compose.yml` for details. 