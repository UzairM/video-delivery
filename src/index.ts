import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import videosRouter from './routes/videos';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/videos', videosRouter);

// Serve static files
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