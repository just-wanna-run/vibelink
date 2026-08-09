import { useState } from 'react';
import type { Message } from '../store/chatStore';
import { downloadFile } from '../services/download';

interface Props {
  message: Message;
  onDelete: (id: string) => void;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function formatDateHeader(ts: number): string {
  // Handle ISO strings or NaN
  let d: Date;
  if (typeof ts === 'string') {
    d = new Date(ts);
  } else if (typeof ts === 'number' && !isNaN(ts)) {
    d = new Date(ts * 1000);
  } else {
    d = new Date();
  }
  if (isNaN(d.getTime())) d = new Date();
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
  const { type, content, file_name, file_size, file_type, file_path, pending } = message;
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

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
        <div className="img-bubble" style={{ position: 'relative' }}>
          <img
            src={content}
            alt="图片"
            style={{ width: '100%', display: 'block', cursor: 'pointer', borderRadius: 12 }}
            loading="lazy"
            onClick={() => setPreviewOpen(true)}
          />
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const blob = await (await fetch(content!)).blob();
                if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], `image.jpg`, { type: blob.type })] })) {
                  await navigator.share({ files: [new File([blob], `image.jpg`, { type: blob.type })] });
                } else {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `vibelink_${Date.now()}.jpg`;
                  document.body.appendChild(a); a.click();
                  document.body.removeChild(a); URL.revokeObjectURL(url);
                }
              } catch {}
            }}
            title={isMobile ? '保存到相册' : '下载'}
            style={{
              position: 'absolute', bottom: 6, right: 6,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: isMobile ? 14 : 12,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          {previewOpen && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 9999,
              }}
              onClick={() => setPreviewOpen(false)}
            >
              <img
                src={content}
                alt="图片"
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
                onClick={(e) => { e.stopPropagation(); setPreviewOpen(false); }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="message-bubble message-sent">
        {type === 'text' && (
          <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
        )}

        {(type === 'file') && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: file_path ? 'pointer' : 'default' }}
            onClick={file_path ? handleDownload : undefined}
            title={file_path ? '点击下载' : ''}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {file_type?.startsWith('video/') ? (
                <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>
              ) : (
                <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>
              )}
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {file_name || '文件'}
              </div>
              {file_size && (
                <div style={{ fontSize: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formatSize(file_size)}
                  {file_path && (
                    <span>{downloading ? '⏳ 下载中...' : '📥 点击下载'}</span>
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

      {/* Action bar */}
      {!pending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {type === 'text' && content && (
            <button onClick={handleCopy} title={copied ? '已复制' : '复制'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 4px', borderRadius: 4, lineHeight: 1,
                color: copied ? 'var(--success)' : 'var(--text-secondary)',
                opacity: copied ? 1 : 0.35, transition: 'opacity 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
              onMouseLeave={(e) => { if (!copied) (e.currentTarget as HTMLElement).style.opacity = '0.35'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {copied ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </>
                )}
              </svg>
            </button>
          )}
          <button onClick={() => onDelete(message.id)} title="删除"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 4px', borderRadius: 4, lineHeight: 1,
              color: 'var(--text-secondary)', opacity: 0.35,
              transition: 'opacity 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.35'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
