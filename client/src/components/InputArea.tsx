import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  onSendText: (text: string) => void;
  onSendFiles: (files: FileList | File[]) => void;
}

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 100;

export default function InputArea({ onSendText, onSendFiles }: Props) {
  const [text, setText] = useState('');
  const [areaHeight, setAreaHeight] = useState(DEFAULT_HEIGHT);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
    textareaRef.current?.focus();
  }, [text, onSendText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle paste for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) onSendFiles(files);
  }, [onSendFiles]);

  // ---- Resize handle (top border drag) ----
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = areaHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY; // drag up = increase height
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + delta));
      setAreaHeight(newHeight);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div style={{
      background: 'var(--white)',
      borderTop: '1px solid var(--border)',
    }}>
      {/* Resize handle — thin bar on top */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 5,
          cursor: 'ns-resize',
          background: 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-light)'}
        onMouseLeave={(e) => { if (!isDragging.current) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Toolbar — single file button (supports images, documents, all types) */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px 12px 0',
      }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          title="发送文件/图片"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 5, borderRadius: 4, lineHeight: 0,
            color: 'var(--text-secondary)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
      </div>

      {/* Hidden file input — accepts images and all file types */}
      <input ref={fileInputRef} type="file" accept="image/*,*/*" multiple style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) { onSendFiles(e.target.files); e.target.value = ''; } }} />

      {/* Textarea */}
      <div style={{ padding: '6px 12px' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          style={{
            width: '100%',
            height: areaHeight,
            resize: 'none',
            padding: '10px 12px',
            border: '1.5px solid var(--border)',
            borderRadius: 6,
            fontSize: 14,
            fontFamily: 'inherit',
            lineHeight: 1.6,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Send button row */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        padding: '0 12px 10px',
      }}>
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="btn btn-primary"
          style={{ padding: '7px 24px', fontSize: 13, borderRadius: 4 }}
        >
          发送
        </button>
      </div>
    </div>
  );
}
