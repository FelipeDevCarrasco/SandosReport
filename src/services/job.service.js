import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.join(__dirname, '../../data/reports');
const JOBS_FILE = path.join(__dirname, '../../data/jobs.json');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const activeJobs = new Map();

function loadJobs() {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const data = fs.readFileSync(JOBS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading jobs:', e.message);
  }
  return {};
}

function saveJobs(jobs) {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
  } catch (e) {
    console.error('Error saving jobs:', e.message);
  }
}

export function createJob(tipo, params = {}) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const job = {
    id: jobId,
    tipo,
    params,
    status: 'pending',
    progress: 0,
    message: 'Iniciando...',
    createdAt: new Date().toISOString(),
    completedAt: null,
    filePath: null,
    fileName: null,
    error: null
  };
  
  activeJobs.set(jobId, job);
  
  const jobs = loadJobs();
  jobs[jobId] = job;
  saveJobs(jobs);
  
  return job;
}

export function updateJob(jobId, updates) {
  const job = activeJobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
    activeJobs.set(jobId, job);
    
    const jobs = loadJobs();
    jobs[jobId] = job;
    saveJobs(jobs);
  }
  return job;
}

export function getJob(jobId) {
  if (activeJobs.has(jobId)) {
    return activeJobs.get(jobId);
  }
  
  const jobs = loadJobs();
  return jobs[jobId] || null;
}

export function getCompletedReports(limit = 20) {
  const jobs = loadJobs();
  
  return Object.values(jobs)
    .filter(j => j.status === 'completed' && j.filePath)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, limit)
    .map(j => ({
      id: j.id,
      fileName: j.fileName,
      createdAt: j.completedAt,
      params: j.params
    }));
}

export function getReportPath(jobId) {
  const job = getJob(jobId);
  if (job && job.filePath && fs.existsSync(job.filePath)) {
    return { path: job.filePath, fileName: job.fileName };
  }
  return null;
}

export function cleanOldReports(maxAgeDays = 7) {
  const jobs = loadJobs();
  const now = Date.now();
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  let cleaned = 0;
  
  for (const [jobId, job] of Object.entries(jobs)) {
    const age = now - new Date(job.createdAt).getTime();
    if (age > maxAge) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        try {
          fs.unlinkSync(job.filePath);
        } catch (e) {}
      }
      delete jobs[jobId];
      activeJobs.delete(jobId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    saveJobs(jobs);
    console.log(`🧹 Limpiados ${cleaned} reportes antiguos`);
  }
}

export { REPORTS_DIR };
