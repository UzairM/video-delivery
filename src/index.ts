import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import videosRouter from './routes/videos';
import { readFileSync } from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/videos', videosRouter);

// Serve static files
app.get('/*.html', (req, res) => {
  const filePath = path.join(__dirname, '../public', req.path);
  let html = readFileSync(filePath, 'utf-8');
  html = html.replace(
    '</head>',
    `<meta name="api-domain" content="${process.env.API_DOMAIN}"></head>`
  );
  res.send(html);
});

app.use(express.static('public'));

// Serve videos.html as the main page
app.get('/', (_req, res) => {
  res.redirect('/videos.html');
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(port, () => {
  console.log(`Video upload service listening on port ${port}`);
}); 