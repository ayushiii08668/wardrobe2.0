import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import clothingRoutes from './routes/clothingRoutes.js';
import outfitRoutes from './routes/outfitRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import garmentRoutes from './routes/garmentRoutes.js';
import tryonRoutes from './routes/tryonRoutes.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env regardless of CWD
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config(); // fallback to CWD if present

const app = express();
const DEFAULT_PORT = process.env.PORT || 5000;

// Security: Hide underlying technology stack
app.disable('x-powered-by');

// CORS configuration supporting single, comma-separated origins, or dev testing
const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = rawClientUrl.split(',').map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. mobile apps, curl, Postman, automated tests)
      if (!origin) return callback(null, true);
      // Allow configured origins or wildcard
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      // In development, automatically allow any localhost / 127.0.0.1 origin on any port (5173, 5174, 5175, etc.)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Body parsing middleware with safe size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads directory safely (includes uploads/clothing and uploads/models)
const uploadsPath = path.resolve('uploads');
app.use(
  '/uploads',
  express.static(uploadsPath, {
    dotfiles: 'ignore',
    index: false,
  })
);

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clothes', clothingRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/garments', garmentRoutes);
app.use('/api/tryon', tryonRoutes);

// 404 Route handling
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

/**
 * Initializes database connection and starts Express server.
 * The server must not report successful startup if the database connection fails.
 */
let server;
const startServer = async (port = DEFAULT_PORT) => {
  try {
    // Connect to database first
    await connectDB();

    // Start listening only after successful database connection
    server = app.listen(port, () => {
      console.log(`[Server] WardrobeWise backend running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
    });
    return server;
  } catch (error) {
    console.error(`[Server Error] Server startup aborted: ${error.message}`);
    process.exit(1);
  }
};

// Automatically start if executed directly via node or nodemon
const isMain =
  process.argv[1] &&
  (path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase() ||
   process.argv[1].endsWith('server.js'));
if (isMain) {
  startServer();
}

export { app, startServer };
export default app;
