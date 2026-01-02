import express from 'express';
import { upload } from '../config/multer.js';
import * as uploadController from '../controllers/upload.controller.js';

const router = express.Router();

router.post('/file1', upload.single('file'), uploadController.uploadFile1);
router.get('/status', uploadController.getStatus);
router.get('/download/processed', uploadController.downloadProcessed);

export default router;

