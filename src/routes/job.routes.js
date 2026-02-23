import express from 'express';
import { 
  createReportJob, 
  getJobStatus, 
  listReports, 
  downloadReport 
} from '../controllers/job.controller.js';

const router = express.Router();

router.post('/report', createReportJob);

router.get('/status/:jobId', getJobStatus);

router.get('/reports', listReports);

router.get('/download/:jobId', downloadReport);

export default router;
