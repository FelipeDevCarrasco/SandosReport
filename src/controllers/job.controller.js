import { startReportJob } from '../services/report-job.service.js';
import { getJob, getCompletedReports, getReportPath, cleanOldReports } from '../services/job.service.js';
import fs from 'fs';

export async function createReportJob(req, res) {
  try {
    const { query = '', fechaDesde = '', fechaHasta = '' } = req.query;
    
    const job = await startReportJob(query, fechaDesde, fechaHasta);
    
    return res.json({
      success: true,
      jobId: job.id,
      status: job.status,
      message: 'Job iniciado correctamente'
    });
    
  } catch (error) {
    console.error('Error al crear job:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function getJobStatus(req, res) {
  try {
    const { jobId } = req.params;
    
    const job = getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job no encontrado'
      });
    }
    
    return res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        message: job.message,
        fileName: job.fileName,
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }
    });
    
  } catch (error) {
    console.error('Error al obtener estado del job:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function listReports(req, res) {
  try {
    cleanOldReports(7);
    
    const reports = getCompletedReports(50);
    
    return res.json({
      success: true,
      reports
    });
    
  } catch (error) {
    console.error('Error al listar reportes:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

export async function downloadReport(req, res) {
  try {
    const { jobId } = req.params;
    
    const report = getReportPath(jobId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado o ya fue eliminado'
      });
    }
    
    if (!fs.existsSync(report.path)) {
      return res.status(404).json({
        success: false,
        message: 'El archivo ya no existe'
      });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    
    const fileStream = fs.createReadStream(report.path);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error al descargar reporte:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
