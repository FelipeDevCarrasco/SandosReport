import * as api from './api.js';
import * as ui from './ui.js';

const ETAPAS_PROCESAMIENTO = [
  { porcentaje: 10, mensaje: 'Cargando archivo...' },
  { porcentaje: 25, mensaje: 'Leyendo datos...' },
  { porcentaje: 40, mensaje: 'Eliminando filas iniciales...' },
  { porcentaje: 55, mensaje: 'Filtrando columnas...' },
  { porcentaje: 70, mensaje: 'Eliminando filas no válidas...' },
  { porcentaje: 85, mensaje: 'Limpiando datos...' },
  { porcentaje: 95, mensaje: 'Generando archivo modificado...' }
];

export function initUploadHandlers(fileInput, uploadArea, fileInfo, progressContainer, messageContainer) {
  uploadArea.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => handleFileSelect(e, fileInput, fileInfo, progressContainer, messageContainer));
  
  ui.setupDragAndDrop(uploadArea, fileInput, (e) => {
    handleFileSelect(e, fileInput, fileInfo, progressContainer, messageContainer);
  });
}

async function handleFileSelect(event, fileInput, fileInfo, progressContainer, messageContainer) {
  const file = event.target.files[0];
  if (!file) return;

  const validExtensions = ['.xlsx', '.xls'];
  const fileExt = '.' + file.name.split('.').pop().toLowerCase();

  if (!validExtensions.includes(fileExt)) {
    ui.showMessage('Por favor, selecciona un archivo Excel (.xlsx o .xls)', 'error', messageContainer);
    return;
  }

  await uploadFile(file, 1, fileInfo, progressContainer, messageContainer);
}

async function uploadFile(file, fileNumber, fileInfo, progressContainer, messageContainer) {
  const progressFill = progressContainer.querySelector('.progress-fill');
  const progressText = progressContainer.querySelector('.progress-text');
  const uploadArea = progressContainer.closest('.file-upload-card').querySelector('.upload-area');

  progressContainer.style.display = 'flex';
  uploadArea.style.display = 'none';

  let etapaActual = 0;
  const progressInterval = setInterval(() => {
    if (etapaActual < ETAPAS_PROCESAMIENTO.length) {
      const etapa = ETAPAS_PROCESAMIENTO[etapaActual];
      ui.updateProgress(progressFill, progressText, etapa.porcentaje, etapa.mensaje);
      etapaActual++;
    } else {
      clearInterval(progressInterval);
    }
  }, 400);

  try {
    const result = await api.uploadFile(file, fileNumber);

    clearInterval(progressInterval);
    ui.updateProgress(progressFill, progressText, 100, 'Completado');

    setTimeout(() => {
      progressContainer.style.display = 'none';
      fileInfo.style.display = 'flex';
      
      fileInfo.querySelector('.file-name').textContent = result.info.filename;
      const statsText = `${result.info.rows} filas • ${result.info.columns.length} columnas`;
      fileInfo.querySelector('.file-stats').textContent = statsText;

      ui.showMessage(result.message, 'success', messageContainer);
      
      checkFilesLoaded();
    }, 500);
  } catch (error) {
    if (progressInterval) clearInterval(progressInterval);
    progressContainer.style.display = 'none';
    uploadArea.style.display = 'block';
    ui.showMessage(`Error al cargar el archivo: ${error.message}`, 'error', messageContainer);
  }
}

function checkFilesLoaded() {
  const fileInfo1 = document.getElementById('fileInfo1');
  const mergeSection = document.getElementById('mergeSection');
  
  if (fileInfo1.style.display !== 'none') {
    mergeSection.style.display = 'block';
  } else {
    mergeSection.style.display = 'none';
  }
}

export { checkFilesLoaded };

