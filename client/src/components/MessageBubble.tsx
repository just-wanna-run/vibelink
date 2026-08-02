import { useState } from 'react';
import type { Message } from '../store/chatStore';
import { downloadFile } from '../services/download';

interface Props {
  message: Message;
  onDelete: (id: string) => void;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function formatDateHeader(ts: number): string {
  const d = new Date(ts * 1000);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${month}月${day}日 ${weekday} ${time}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function MessageBubble({ message, onDelete }: Props) {
  const { type, content, file_name, file_size, file_path, pending } = message;
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDownload = async () => {
    if (!file_path || !file_name) return;
    setDownloading(true);
    try {
      await downloadFile(file_path, file_name);
    } catch {
      alert('下载失败，请重试');
    }
    setDownloading(false);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      marginBottom: 12,
    }}>
      {type === 'image' && content ? (
        <div style={{ maxWidth: 240, borderRadius: 12, overflow: 'hidden' }}>
          <img
            src={content}
            alt="图片"
            style={{ width: '100%', display: 'block', cursor: 'pointer', borderRadius: 12 }}
            loading="lazy"
            onClick={() => setPreviewOpen(true)}
          />
          {previewOpen && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 9999, cursor: 'pointer',
              }}
              onClick={() => setPreviewOpen(false)}
            >
              <img
                src={content}
                alt="图片"
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="message-bubble message-sent">
        {type === 'text' && (
          <span>{content}</span>
        )}

        {(type === 'file') && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: file_path ? 'pointer' : 'default' }}
            onClick={file_path ? handleDownload : undefined}
            title={file_path ? '点击下载' : ''}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {file_name || '文件'}
              </div>
              {file_size && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {formatSize(file_size)}
                  {file_path && (
                    <span style={{ marginLeft: 6 }}>
                      {downloading ? '⏳ 下载中...' : '📥 点击下载'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {pending && (
          <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4 }}>发送中...</span>
        )}
      </div>
      )}

      {/* Delete button */}
      {!pending && (
        <button
          onClick={() => onDelete(message.id)}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 12,
            opacity: 0.5, marginTop: 2, padding: '0 4px',
          }}
          title="删除"
        >
          🗑
        </button>
      )}
    </div>
  );
}
