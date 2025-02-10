# Future LL-HLS Latency Improvements

## 1. Segment Optimization
```text
Current: 2s segments with 0.3s partials
Improve: 1s segments with 0.2s partials

ffmpeg options:
-hls_time 1
-hls_part_time 0.2
-hls_init_time 1
```

## 2. Preload Hints
```html
Add HTTP preload hints in playlist:
#EXT-X-PRELOAD-HINT:TYPE=PART,URI="fileSequence2.1.part"
```

## 3. CloudFront Configuration
```text
- Enable Brotli compression
- Set lower TTLs for playlists (1-2s)
- Configure origin shield in closest region
- Enable HTTP/3 (QUIC) support
```

## 4. Blocking Playlist Updates
```text
Current: 0.6s hold-back
Improve: 0.4s hold-back

#EXT-X-SERVER-CONTROL:
  CAN-BLOCK-RELOAD=YES,
  PART-HOLD-BACK=0.4,
  HOLD-BACK=3
```

## 5. Aggressive Buffering Strategy
- Start playback after 1 partial segment
- Maintain 2-3 partial segments buffer
- Drop segments aggressively if behind

## 6. Network Optimizations
```text
- Use HTTP/3 for transport
- Enable TCP BBR congestion control
- Set TCP_NODELAY for segments
- Use persistent connections
```

## 7. Processing Pipeline
```text
Current: Sequential processing
Improve: Parallel processing
- Start uploading segments while encoding continues
- Process audio/video streams in parallel
- Use hardware acceleration (NVENC/QuickSync)
```

## Expected Results
- Current: ~2-3s latency
- After improvements: ~1-1.5s latency
- Startup time: ~500ms

## Trade-offs
- Higher CPU usage
- More bandwidth usage
- Increased storage operations
- Potential for more buffering on poor connections 

## CloudFront LL-HLS Optimizations

Configure CloudFront distribution with:

```text
- Origin Shield: Enabled (closest region)
- Origin Protocol Policy: HTTPS Only
- HTTP/3: Enabled
- Origin Response Timeout: 4 seconds
- Origin Keep-alive Timeout: 5 seconds
- Cache Based on Selected Request Headers: Include 'Origin'
- Query String Forwarding: None
- Compress Objects Automatically: Yes
- Viewer Protocol Policy: Redirect HTTP to HTTPS
- Cache Policy:
  - Min TTL: 0
  - Max TTL: 31536000
  - Default TTL: 86400
  - Enable stale-while-revalidate
  - Enable compression
- Origin Request Policy:
  - Headers: Include 'Origin'
  - Headers: Include 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'
  - Query Strings: None
  - Cookies: None
- Response Headers Policy:
  - CORS-With-Preflight
  - Access-Control-Allow-Origin: *
  - Access-Control-Allow-Methods: GET, HEAD
  - Access-Control-Allow-Headers: *
  - Access-Control-Max-Age: 86400
```

These settings optimize for:
1. Low latency delivery
2. Better cache hit ratios
3. HTTP/3 (QUIC) support
4. Proper CORS handling
5. Automatic compression 