export function showMessage(text, type = 'info', container) {
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;
  
  container.appendChild(message);

  setTimeout(() => {
    message.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => message.remove(), 300);
  }, 5000);
}

export function updateProgress(progressFill, progressText, porcentaje, mensaje) {
  progressFill.style.width = `${porcentaje}%`;
  progressText.textContent = `${porcentaje}% - ${mensaje}`;
}

export function setupDragAndDrop(area, input, callback) {
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
      callback({ target: input });
    }
  });
}

