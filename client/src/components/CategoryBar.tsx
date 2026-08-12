import { useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import api from '../services/api';

interface Category {
  id: string;
  name: string;
  color: string;
}

const COLORS = ['#5B9BD5', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#795548', '#607D8B'];

export default function CategoryBar() {
  const { selectedCategoryId, setSelectedCategoryId } = useChatStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#5B9BD5');

  const fetchCats = async () => {
    try { const { data } = await api.get('/categories'); setCategories(data.categories || []); } catch {}
  };

  useEffect(() => { fetchCats(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, { name: name.trim(), color });
      } else {
        await api.post('/categories', { name: name.trim(), color });
        if (categories.length === 0) setSelectedCategoryId(null);
      }
      setShowModal(false); setEditing(null); setName(''); fetchCats();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此分类？')) return;
    try {
      await api.delete(`/categories/${id}`);
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      fetchCats();
    } catch {}
  };

  const openEdit = (cat: Category) => {
    setEditing(cat); setName(cat.name); setColor(cat.color); setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null); setName(''); setColor('#5B9BD5'); setShowModal(true);
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        <button
          onClick={() => setSelectedCategoryId(null)}
          style={{
            padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: !selectedCategoryId ? 700 : 400,
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            background: !selectedCategoryId ? 'var(--primary)' : 'var(--border)',
            color: !selectedCategoryId ? '#fff' : 'var(--text)',
          }}
        >全部</button>
        {categories.map((cat) => (
          <div key={cat.id} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setSelectedCategoryId(cat.id)}
              onDoubleClick={() => openEdit(cat)}
              style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: selectedCategoryId === cat.id ? 700 : 400,
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                background: selectedCategoryId === cat.id ? cat.color : 'var(--border)',
                color: selectedCategoryId === cat.id ? '#fff' : 'var(--text)',
              }}
            >{cat.name}</button>
          </div>
        ))}
        <button
          onClick={openCreate}
          style={{
            padding: '4px 10px', borderRadius: 16, fontSize: 14, fontWeight: 600,
            border: '1.5px dashed var(--border)', cursor: 'pointer', flexShrink: 0,
            background: 'transparent', color: 'var(--text-secondary)', lineHeight: 1,
          }}
        >+</button>
      </div>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{editing ? '编辑分类' : '新建分类'}</h3>
            <div className="input-group">
              <label>分类名称</label>
              <input type="text" placeholder="输入名称" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="input-group">
              <label>颜色</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent',
                    cursor: 'pointer',
                  }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              {editing && (
                <button onClick={() => handleDelete(editing.id)} className="btn btn-danger" style={{ fontSize: 13, padding: '8px 16px', marginRight: 'auto' }}>删除</button>
              )}
              <button onClick={() => setShowModal(false)} className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}>取消</button>
              <button onClick={handleSave} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
