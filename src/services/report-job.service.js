import path from 'path';
import { createJob, updateJob, REPORTS_DIR } from './job.service.js';
import { generarReporteExcelVentas } from './report-combined.service.js';

export async function startReportJob(query = '', fechaDesde = '', fechaHasta = '') {
  const job = createJob('excel-report', { query, fechaDesde, fechaHasta });
  
  processReportJob(job.id, query, fechaDesde, fechaHasta);
  
  return job;
}

async function processReportJob(jobId, query, fechaDesde, fechaHasta) {
  try {
    updateJob(jobId, { 
      status: 'processing', 
      progress: 10, 
      message: 'Obteniendo datos de Shipit...' 
    });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `reporte-${timestamp}.xlsx`;
    const filePath = path.join(REPORTS_DIR, fileName);
    
    updateJob(jobId, { 
      progress: 30, 
      message: 'Consultando datos de Sphinx...' 
    });
    
    await generarReporteExcelVentas(query, fechaDesde, fechaHasta, filePath, (progress, message) => {
      updateJob(jobId, { progress: 30 + Math.floor(progress * 0.6), message });
    });
    
    updateJob(jobId, { 
      status: 'completed',
      progress: 100, 
      message: 'Reporte generado exitosamente',
      completedAt: new Date().toISOString(),
      filePath,
      fileName
    });
    
    console.log(`✅ Job ${jobId} completado: ${fileName}`);
    
  } catch (error) {
    console.error(`❌ Job ${jobId} falló:`, error.message);
    updateJob(jobId, { 
      status: 'failed',
      progress: 0,
      message: error.message,
      error: error.message
    });
  }
}
