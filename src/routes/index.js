import express from 'express';
import uploadRoutes from './upload.routes.js';
import shipitRoutes from './shipit.routes.js';

const router = express.Router();

router.use('/upload', uploadRoutes);
router.use('/shipit', shipitRoutes);

export default router;

