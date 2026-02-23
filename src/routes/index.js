import express from 'express';
import reportRoutes from './report.routes.js';
import shipitRoutes from './shipit.routes.js';
import sphinxRoutes from './sphinx.routes.js';

const router = express.Router();

router.use('/report', reportRoutes);
router.use('/shipit', shipitRoutes);
router.use('/sphinx', sphinxRoutes);

export default router;

