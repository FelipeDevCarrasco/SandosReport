import express from 'express';
import * as shipitController from '../controllers/shipit.controller.js';

const router = express.Router();

router.get('/order/:reference', shipitController.getOrder);
router.get('/merge', shipitController.mergeAndDownload);

export default router;

