import express from 'express';
import multer from 'multer';
import path from 'path';
import { handleGenerateTryOn, handleAnalyzeGarment } from '../controllers/tryonController.js';
import { optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Memory storage keeps file buffers directly accessible in req.files
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB limit per file
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isImage = (file.mimetype && file.mimetype.toLowerCase().startsWith('image/')) ||
                    ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext);
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image format (${file.mimetype || ext}). Please upload a JPEG, PNG, or WEBP image.`));
    }
  },
});

const uploadFields = upload.fields([
  { name: 'personImage', maxCount: 1 },
  { name: 'garmentImage', maxCount: 1 },
]);

// Wrapper middleware to gracefully catch Multer errors without terminating the socket
const uploadTryOnMiddleware = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err) {
      console.warn('[tryonRoutes] Upload middleware notice:', err.message);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Uploaded image exceeds the 30 MB size limit.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Error processing uploaded images.',
      });
    }
    next();
  });
};

/**
 * @route   POST /api/tryon/analyze-garment
 * @desc    Analyze clothing image with Gemini Vision (category, silhouette, single skirt)
 * @access  Public / Optional Auth
 */
router.post('/analyze-garment', optionalProtect, upload.single('garmentImage'), handleAnalyzeGarment);

/**
 * @route   POST /api/tryon/generate
 * @desc    Generate photorealistic virtual try-on image using Google Gemini
 * @access  Public / Optional Auth
 */
router.post('/generate', optionalProtect, uploadTryOnMiddleware, handleGenerateTryOn);

export default router;

