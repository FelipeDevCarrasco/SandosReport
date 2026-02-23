import express from 'express';
import * as sphinxController from '../controllers/sphinx.controller.js';

const router = express.Router();

router.get('/status', sphinxController.getStatus);
router.get('/factura/:folio', sphinxController.consultarFactura);
router.get('/boleta/:folio', sphinxController.consultarBoleta);

// Actualizar sesión (manual o automática)
router.post('/session', express.json(), sphinxController.updateSession);
router.post('/refresh', sphinxController.refreshSession);

export default router;
