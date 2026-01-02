import * as upload from './upload.js';
import * as api from './api.js';
import * as ui from './ui.js';

let currentFiles = {
  file1: null
};

function init() {
  const fileInput1 = document.getElementById('fileInput1');
  const uploadArea1 = document.getElementById('uploadArea1');
  const fileInfo1 = document.getElementById('fileInfo1');
  const progressContainer1 = document.getElementById('progressContainer1');
  const messageContainer = document.getElementById('messageContainer');
  const removeFile1 = document.getElementById('removeFile1');
  const downloadProcessed1 = document.getElementById('downloadProcessed1');
  const btnMerge = document.getElementById('btnMerge');

  upload.initUploadHandlers(fileInput1, uploadArea1, fileInfo1, progressContainer1, messageContainer);

  removeFile1.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFile(1, fileInput1, uploadArea1, fileInfo1, progressContainer1, messageContainer);
  });

  downloadProcessed1.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadProcessedFile(downloadProcessed1, messageContainer);
  });

  btnMerge.addEventListener('click', () => {
    mergeAndDownload(btnMerge, messageContainer);
  });
}

function removeFile(fileNumber, fileInput, uploadArea, fileInfo, progressContainer, messageContainer) {
  currentFiles[`file${fileNumber}`] = null;
  fileInput.value = '';
  fileInfo.style.display = 'none';
  progressContainer.style.display = 'none';
  uploadArea.style.display = 'block';
  ui.showMessage(`Archivo ${fileNumber} eliminado`, 'info', messageContainer);
  upload.checkFilesLoaded();
}

async function downloadProcessedFile(btnDownload, messageContainer) {
  const originalText = btnDownload.textContent;
  
  btnDownload.disabled = true;
  btnDownload.textContent = '⏳';
  
  try {
    const response = await api.downloadProcessed();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'archivo_procesado.xlsx';
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '').trim();
        if (!filename.endsWith('.xlsx')) {
          filename = filename.replace(/\.xlsx.*$/i, '') + '.xlsx';
        }
      }
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    ui.showMessage('Archivo procesado descargado correctamente', 'success', messageContainer);
  } catch (error) {
    ui.showMessage(`Error al descargar el archivo: ${error.message}`, 'error', messageContainer);
  } finally {
    btnDownload.disabled = false;
    btnDownload.textContent = originalText;
  }
}

async function mergeAndDownload(btnMerge, messageContainer) {
  const originalText = btnMerge.textContent;
  
  btnMerge.disabled = true;
  btnMerge.textContent = '⏳ Procesando archivo...';
  
  try {
    const response = await api.mergeAndDownload();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'archivo_procesado.xlsx';
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '').trim();
        if (!filename.endsWith('.xlsx')) {
          filename = filename.replace(/\.xlsx.*$/i, '') + '.xlsx';
        }
      }
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    ui.showMessage('Archivo procesado y descargado correctamente', 'success', messageContainer);
  } catch (error) {
    ui.showMessage(`Error al procesar el archivo: ${error.message}`, 'error', messageContainer);
  } finally {
    btnMerge.disabled = false;
    btnMerge.textContent = originalText;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

