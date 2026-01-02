const API_BASE = '/api';

export async function uploadFile(file, fileNumber) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileNumber', fileNumber);

  const response = await fetch(`${API_BASE}/upload/file${fileNumber}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }

  return await response.json();
}

export async function getStatus() {
  const response = await fetch(`${API_BASE}/upload/status`);
  return await response.json();
}

export async function downloadProcessed() {
  const response = await fetch(`${API_BASE}/upload/download/processed`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }
  return response;
}

export async function mergeAndDownload() {
  const response = await fetch(`${API_BASE}/shipit/merge`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }
  return response;
}

