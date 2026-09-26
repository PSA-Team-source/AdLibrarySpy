'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import type { FavoriteFolder } from '@/lib/favorite-folders';

type Entity = 'shop' | 'ad';

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

/** "All my X" · "Default Folder" · user folders · "+ New folder". */
export function FolderBar({ slug, entity, label, folders, all, unfiled, current }: {
  slug: string; entity: Entity; label: string;
  folders: FavoriteFolder[]; all: number; unfiled: number; current: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'new' | 'rename'>('idle');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = folders.find(f => f.id === current);
  const base = `/favorites/${slug}`;

  const run = (fn: () => Promise<void>) => { setError(null); start(async () => { try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } }); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'new') {
        const { folder } = await send('/api/favorites/folders', 'POST', { type: entity, name });
        router.push(`${base}?folder=${folder.id}`);
      } else if (active) {
        await send('/api/favorites/folders', 'PATCH', { id: active.id, name });
        router.refresh();
      }
      setMode('idle'); setName('');
    });
  };

  const remove = () => {
    if (!active || !window.confirm(`Delete "${active.name}"? Its items move to the Default Folder.`)) return;
    run(async () => { await send('/api/favorites/folders', 'DELETE', { id: active.id }); router.push(base); });
  };

  const pill = (href: string, on: boolean, text: string, count: number, icon: React.ReactNode) => (
    <Link key={href} href={href} aria-current={on ? 'page' : undefined} className={`chip ${on ? 'chip-active' : ''}`}>
      {icon}{text}<span className="tabular-nums text-xs opacity-70">{count}</span>
    </Link>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {pill(base, current === 'all', `All my ${label}`, all, <FolderOpen className="h-4 w-4" />)}
        {pill(`${base}?folder=default`, current === 'default', 'Default Folder', unfiled, <Folder className="h-4 w-4" />)}
        {folders.map(f => pill(`${base}?folder=${f.id}`, current === f.id, f.name, f.count, <Folder className="h-4 w-4" />))}
        {mode === 'idle' ? (
          <button type="button" onClick={() => { setMode('new'); setName(''); }} className="chip">
            <Plus className="h-4 w-4" />New folder
          </button>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-2">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} required
              aria-label={mode === 'new' ? 'New folder name' : 'Folder name'} placeholder="Folder name"
              onKeyDown={e => { if (e.key === 'Escape') setMode('idle'); }}
              className="field h-9 w-48" />
            <button type="submit" disabled={pending || !name.trim()} className="btn-primary h-9">{mode === 'new' ? 'Create' : 'Save'}</button>
            <button type="button" onClick={() => setMode('idle')} className="btn-ghost h-9">Cancel</button>
          </form>
        )}
        {active && mode === 'idle' && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => { setMode('rename'); setName(active.name); }} className="btn-ghost h-9 px-3" title="Rename folder">
              <Pencil className="h-3.5 w-3.5" />Rename
            </button>
            <button type="button" onClick={remove} disabled={pending} className="btn-ghost h-9 px-3" title="Delete folder">
              <Trash2 className="h-3.5 w-3.5" />Delete
            </button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Folder picker for one saved item. Renders nothing until the user has a folder. */
export function MoveToFolder({ entity, id, folderId, folders }: {
  entity: Entity; id: string; folderId: string | null; folders: FavoriteFolder[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(folderId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!folders.length) return null;

  const move = (next: string) => {
    const prev = value;
    setValue(next); setError(null);
    start(async () => {
      try { await send('/api/favorites', 'PATCH', { type: entity, id, folderId: next || null }); router.refresh(); }
      catch (e) { setValue(prev); setError(e instanceof Error ? e.message : 'Could not move'); }
    });
  };

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <select value={value} disabled={pending} onChange={e => move(e.target.value)} aria-label="Folder"
        title={error ?? undefined}
        className={`h-8 min-w-0 flex-1 rounded-md border bg-input px-2 text-xs text-foreground ${error ? 'border-destructive' : 'border-[hsl(var(--input-border))]'}`}>
        <option value="">Default Folder</option>
        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </label>
  );
}
