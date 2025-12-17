// Referencias a los elementos del DOM
const fileInput1 = document.getElementById('fileInput1');
const uploadArea1 = document.getElementById('uploadArea1');
const fileInfo1 = document.getElementById('fileInfo1');
const messageContainer = document.getElementById('messageContainer');

// Estado de los archivos
let currentFiles = {
    file1: null
};

// Inicializar eventos
function init() {
    // Archivo 1
    uploadArea1.addEventListener('click', () => fileInput1.click());
    fileInput1.addEventListener('change', (e) => handleFileSelect(e, 1));
    setupDragAndDrop(uploadArea1, fileInput1, 1);

    // Botón de eliminar
    document.getElementById('removeFile1').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(1);
    });

    // Botón de descarga del archivo procesado
    document.getElementById('downloadProcessed1').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadProcessedFile();
    });

    // Botón para procesar archivo
    document.getElementById('btnMerge').addEventListener('click', mergeAndDownload);
}

// Configurar drag and drop
function setupDragAndDrop(area, input, fileNumber) {
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
        area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            handleFileSelect({ target: input }, fileNumber);
        }
    });
}

// Manejar selección de archivo
function handleFileSelect(event, fileNumber) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    const validExtensions = ['.xlsx', '.xls'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(fileExt)) {
        showMessage('Por favor, selecciona un archivo Excel (.xlsx o .xls)', 'error');
        return;
    }

    currentFiles[`file${fileNumber}`] = file;
    uploadFile(file, fileNumber);
}

// Subir archivo al servidor
async function uploadFile(file, fileNumber) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileNumber', fileNumber);

    const progressContainer = document.getElementById(`progressContainer${fileNumber}`);
    const progressFill = document.getElementById(`progressFill${fileNumber}`);
    const progressText = document.getElementById(`progressText${fileNumber}`);
    const uploadArea = document.getElementById(`uploadArea${fileNumber}`);
    const fileInfo = document.getElementById(`fileInfo${fileNumber}`);

    // Mostrar barra de progreso
    progressContainer.style.display = 'flex';
    uploadArea.style.display = 'none';

    // Progreso del procesamiento del archivo (Sphinx)
    const etapas = [
        { porcentaje: 10, mensaje: 'Cargando archivo...' },
        { porcentaje: 25, mensaje: 'Leyendo datos...' },
        { porcentaje: 40, mensaje: 'Eliminando filas iniciales...' },
        { porcentaje: 55, mensaje: 'Filtrando columnas...' },
        { porcentaje: 70, mensaje: 'Eliminando filas no válidas...' },
        { porcentaje: 85, mensaje: 'Limpiando datos...' },
        { porcentaje: 95, mensaje: 'Generando archivo modificado...' }
    ];

    let etapaActual = 0;
    const progressInterval = setInterval(() => {
        if (etapaActual < etapas.length) {
            const etapa = etapas[etapaActual];
            progressFill.style.width = `${etapa.porcentaje}%`;
            progressText.textContent = `${etapa.porcentaje}% - ${etapa.mensaje}`;
            etapaActual++;
        } else {
            clearInterval(progressInterval);
        }
    }, 400);

    try {
        const response = await fetch(`/api/upload/file${fileNumber}`, {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        
        // Asegurar que el progreso llegue al 100%
        progressFill.style.width = '100%';
        progressText.textContent = '100% - Completado';

        const result = await response.json();

        if (response.ok) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
                fileInfo.style.display = 'flex';
                
                // Mostrar información del archivo
                document.getElementById(`fileName${fileNumber}`).textContent = result.info.filename;
                const statsText = `${result.info.rows} filas • ${result.info.columns.length} columnas`;
                document.getElementById(`fileStats${fileNumber}`).textContent = statsText;

                showMessage(result.message, 'success');
                
                // Verificar si el archivo está cargado para mostrar el botón de procesar
                checkFilesLoaded();
            }, 500);
        } else {
            throw new Error(result.message || result.error);
        }
    } catch (error) {
        if (progressInterval) clearInterval(progressInterval);
        progressContainer.style.display = 'none';
        uploadArea.style.display = 'block';
        currentFiles[`file${fileNumber}`] = null;
        showMessage(`Error al cargar el archivo: ${error.message}`, 'error');
    }
}

// Eliminar archivo
function removeFile(fileNumber) {
    currentFiles[`file${fileNumber}`] = null;
    const fileInput = document.getElementById(`fileInput${fileNumber}`);
    const uploadArea = document.getElementById(`uploadArea${fileNumber}`);
    const fileInfo = document.getElementById(`fileInfo${fileNumber}`);
    const progressContainer = document.getElementById(`progressContainer${fileNumber}`);

    fileInput.value = '';
    fileInfo.style.display = 'none';
    progressContainer.style.display = 'none';
    uploadArea.style.display = 'block';

    showMessage(`Archivo ${fileNumber} eliminado`, 'info');
    checkFilesLoaded();
}

// Verificar si el archivo está cargado
function checkFilesLoaded() {
    const fileInfo1 = document.getElementById('fileInfo1');
    const mergeSection = document.getElementById('mergeSection');
    
    if (fileInfo1.style.display !== 'none') {
        mergeSection.style.display = 'block';
    } else {
        mergeSection.style.display = 'none';
    }
}

// Descargar archivo procesado
async function downloadProcessedFile() {
    const btnDownload = document.getElementById('downloadProcessed1');
    const originalText = btnDownload.textContent;
    
    btnDownload.disabled = true;
    btnDownload.textContent = '⏳';
    
    try {
        const response = await fetch('/api/download/processed');
        
        if (response.ok) {
            // Obtener el nombre del archivo del header Content-Disposition
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
            
            // Descargar el archivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showMessage('Archivo procesado descargado correctamente', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || error.error || 'Error al descargar el archivo procesado');
        }
    } catch (error) {
        showMessage(`Error al descargar el archivo: ${error.message}`, 'error');
    } finally {
        btnDownload.disabled = false;
        btnDownload.textContent = originalText;
    }
}

// Procesar archivo y descargar
async function mergeAndDownload() {
    const btnMerge = document.getElementById('btnMerge');
    const originalText = btnMerge.textContent;
    
    btnMerge.disabled = true;
    btnMerge.textContent = '⏳ Procesando archivo...';
    
    try {
        const response = await fetch('/api/merge');
        
        if (response.ok) {
            // Obtener el nombre del archivo del header Content-Disposition
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'archivo_procesado.xlsx';
            if (contentDisposition) {
                // Extraer el nombre del archivo, manejando diferentes formatos
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '').trim();
                    // Asegurar que termine en .xlsx
                    if (!filename.endsWith('.xlsx')) {
                        filename = filename.replace(/\.xlsx.*$/i, '') + '.xlsx';
                    }
                }
            }
            
            // Descargar el archivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showMessage('Archivo procesado y descargado correctamente', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.message || error.error || 'Error al procesar el archivo');
        }
    } catch (error) {
        showMessage(`Error al procesar el archivo: ${error.message}`, 'error');
    } finally {
        btnMerge.disabled = false;
        btnMerge.textContent = originalText;
    }
}

// Mostrar mensaje
function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    messageContainer.appendChild(message);

    // Eliminar mensaje después de 5 segundos
    setTimeout(() => {
        message.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => message.remove(), 300);
    }, 5000);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

