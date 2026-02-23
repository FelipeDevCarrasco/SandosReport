import express from 'express';
import authRoutes from './auth.routes.js';
import reportRoutes from './report.routes.js';
import shipitRoutes from './shipit.routes.js';
import sphinxRoutes from './sphinx.routes.js';
import jobRoutes from './job.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/report', reportRoutes);
router.use('/shipit', shipitRoutes);
router.use('/sphinx', sphinxRoutes);
router.use('/jobs', jobRoutes);

export default router;

