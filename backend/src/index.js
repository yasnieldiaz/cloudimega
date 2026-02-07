import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import fileRoutes from './routes/files.js';
import folderRoutes from './routes/folders.js';
import shareRoutes from './routes/shares.js';
import tagRoutes from './routes/tags.js';
import commentRoutes from './routes/comments.js';
import activityRoutes from './routes/activity.js';
import adminRoutes from './routes/admin.js';
import favoritesRoutes from './routes/favorites.js';
import streamRoutes from './routes/stream.js';
import searchRoutes from './routes/search.js';

// Database
import { initDatabase } from './models/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Create storage directory
const storagePath = process.env.STORAGE_PATH || join(__dirname, '../../storage');
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initDatabase();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/folders', folderRoutes);
app.use('/api/v1/shares', shareRoutes);
app.use('/api/v1/tags', tagRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/activity', activityRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/favorites', favoritesRoutes);
app.use('/api/v1/stream', streamRoutes);
app.use('/api/v1/search', searchRoutes);

// Public share access
app.use('/s', shareRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`CloudImega backend running on http://localhost:${PORT}`);
});
