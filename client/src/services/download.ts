import { getStoredToken } from './api';

export async function downloadFile(filePath: string, fileName: string) {
  const token = getStoredToken();
  if (!token) throw new Error('未登录');

  const apiBase = import.meta.env.VITE_API_URL || '/api';
  const response = await fetch(`${apiBase}/files/${encodeURIComponent(filePath)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('下载失败');
  }

  // Get filename from Content-Disposition header or use provided name
  const disposition = response.headers.get('Content-Disposition');
  let downloadName = fileName;
  if (disposition) {
    const match = disposition.match(/filename\*=UTF-8''(.+)/);
    if (match) {
      downloadName = decodeURIComponent(match[1]);
    }
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
