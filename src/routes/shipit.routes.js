import express from 'express';
import * as shipitController from '../controllers/shipit.controller.js';

const router = express.Router();

router.get('/ventas', shipitController.getVentas);
router.post('/vendedores', shipitController.getVendedores);
router.get('/ventas/excel', shipitController.exportVentasExcel);
router.get('/order/:reference', shipitController.getOrder);

export default router;

