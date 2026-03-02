import express from 'express';
import * as reportController from '../controllers/report.controller.js';

const router = express.Router();

router.get('/generate', reportController.generateReport);
router.get('/detail', reportController.getDetail);
router.get('/excel', reportController.generateExcelReport);

export default router;
