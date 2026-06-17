'use client'

import { use, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'

const GAME_LABELS: Record<string, string> = {
  petitbac: '🔤 Petit Bac', fibbage: '🤥 Fibbage', quiplash: '✍️ Quiplash',
  familyfeud: '📊 Une Famille en Or', mostlikely: '🫵 Qui est le + susceptible', justeprix: '🎯 Juste Prix',
}

type GameType = 'petitbac' | 'fibbage' | 'quiplash' | 'familyfeud' | 'mostlikely' | 'justeprix'

const DEFAULT_CONFIGS: Record<GameType, unknown> = {
  petitbac: { durationSec: 90, categories: ['Pays', 'Animal', 'Prénom', 'Ville', 'Métier'] },
  fibbage: { durationSec: 60, questions: [{ text: '', answer: '' }] },
  quiplash: { durationSec: 60, prompts: [''] },
  familyfeud: { durationSec: 30, surveys: [{ question: '', answers: [{ text: '', count: 0 }] }] },
  mostlikely: { prompts: [''] },
  justeprix: { durationSec: 30, items: [{ label: '', price: 0, trapNote: '' }] },
}

export default function SessionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sessionId = id as Id<'sessions'>
  const session = useQuery(api.sessions.get, { sessionId })
  const addGame = useMutation(api.sessions.addGame)
  const removeGame = useMutation(api.sessions.removeGame)
  const reorder = useMutation(api.sessions.reorderGames)
  const [adding, setAdding] = useState(false)

  if (session === undefined) return <main className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /></main>
  if (session === null) return <main className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-3"><p className="text-gray-400">Soirée introuvable.</p><Link href="/sessions" className="text-violet-400 text-sm hover:underline">← Soirées</Link></main>

  const games = session.games

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= games.length) return
    const ids = games.map((g) => g._id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder({ orderedGameIds: ids })
  }

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link href={`/session/${id}`} className="text-gray-500 hover:text-white text-sm shrink-0">← Écran host</Link>
        <p className="flex-1 text-sm font-bold text-white truncate">Éditer · {session.name}</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {games.map((g, i) => (
          <div key={g._id} className="rounded-2xl border border-gray-800 bg-gray-900/40">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-bold text-white flex-1">{i + 1}. {GAME_LABELS[g.type] ?? g.type}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 text-gray-300 text-xs">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === games.length - 1} className="px-2 py-1 rounded bg-gray-800 disabled:opacity-30 text-gray-300 text-xs">↓</button>
              <button onClick={() => removeGame({ gameId: g._id })} className="px-2 py-1 rounded bg-red-900/40 text-red-300 text-xs">✕</button>
            </div>
            <div className="p-4">
              <GameEditor gameId={g._id} type={g.type as GameType} config={g.config} />
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-2">
          {adding ? (
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-gray-800 bg-gray-900/40">
              {(Object.keys(GAME_LABELS) as GameType[]).map((t) => (
                <button key={t} onClick={() => { addGame({ sessionId, type: t, title: GAME_LABELS[t].replace(/^\S+\s/, ''), config: DEFAULT_CONFIGS[t] }); setAdding(false) }}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm">{GAME_LABELS[t]}</button>
              ))}
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-gray-500 text-sm">Annuler</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="py-3 rounded-xl border border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm transition-colors">+ Ajouter un jeu</button>
          )}
        </div>
      </div>
    </main>
  )
}

// ── Editor router ──────────────────────────────────────────────

function GameEditor({ gameId, type, config }: { gameId: Id<'games'>; type: GameType; config: Record<string, unknown> }) {
  const update = useMutation(api.sessions.updateGame)
  const [draft, setDraft] = useState<Record<string, unknown>>(config ?? {})
  const [saved, setSaved] = useState(false)

  function save() { update({ gameId, config: draft }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 1500) }) }
  function set(key: string, value: unknown) { setDraft((d) => ({ ...d, [key]: value })); setSaved(false) }

  return (
    <div className="flex flex-col gap-3">
      {type === 'petitbac' && <PetitBacEditor draft={draft} set={set} />}
      {type === 'fibbage' && <FibbageEditor draft={draft} set={set} />}
      {(type === 'quiplash' || type === 'mostlikely') && <PromptsEditor draft={draft} set={set} />}
      {type === 'familyfeud' && <FamilyFeudEditor draft={draft} set={set} />}
      {type === 'justeprix' && <JustePrixEditor draft={draft} set={set} gameId={gameId} />}
      <button onClick={save} className={`self-start px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-green-700 text-green-100' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}>
        {saved ? '✓ Enregistré' : 'Enregistrer'}
      </button>
    </div>
  )
}

// helpers
const cls = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-violet-500'
function linesToArr(s: string) { return s.split('\n').map((l) => l.trim()).filter(Boolean) }
function arrToLines(a?: unknown[]) { return (a ?? []).join('\n') }

type EditorProps = { draft: Record<string, unknown>; set: (k: string, v: unknown) => void }

function DurationField({ draft, set }: EditorProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-400">
      Chrono (s)
      <input type="number" value={(draft.durationSec as number) ?? 60} onChange={(e) => set('durationSec', parseInt(e.target.value) || 0)} className="w-20 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white" />
    </label>
  )
}

function PetitBacEditor({ draft, set }: EditorProps) {
  return (
    <>
      <DurationField draft={draft} set={set} />
      <p className="text-xs text-gray-500">Manches illimitées, lettre tirée au hasard à chaque fois. Le host décide quand relancer ou terminer.</p>
      <span className="text-xs text-gray-500">Catégories (une par ligne)</span>
      <textarea value={arrToLines(draft.categories as string[])} onChange={(e) => set('categories', linesToArr(e.target.value))} rows={8} className={cls} />
    </>
  )
}

function FibbageEditor({ draft, set }: EditorProps) {
  const qs = (draft.questions as { text: string; answer: string }[]) ?? []
  function setQ(i: number, patch: Partial<{ text: string; answer: string }>) { set('questions', qs.map((q, j) => (j === i ? { ...q, ...patch } : q))) }
  return (
    <>
      <DurationField draft={draft} set={set} />
      <p className="text-xs text-gray-500">Mets ___ à l&apos;endroit du trou. La « vraie réponse » est cachée parmi les bluffs.</p>
      {qs.map((q, i) => (
        <div key={i} className="flex flex-col gap-1.5 p-2 rounded-lg border border-gray-800">
          <textarea value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} rows={2} placeholder="Question avec ___" className={cls} />
          <div className="flex gap-2">
            <input value={q.answer} onChange={(e) => setQ(i, { answer: e.target.value })} placeholder="Vraie réponse" className={cls} />
            <button onClick={() => set('questions', qs.filter((_, j) => j !== i))} className="text-red-400 text-xs shrink-0">retirer</button>
          </div>
        </div>
      ))}
      <button onClick={() => set('questions', [...qs, { text: '', answer: '' }])} className="self-start text-violet-400 text-xs">+ question</button>
    </>
  )
}

function PromptsEditor({ draft, set }: EditorProps) {
  return (
    <>
      {draft.durationSec !== undefined && <DurationField draft={draft} set={set} />}
      <span className="text-xs text-gray-500">Une consigne / question par ligne</span>
      <textarea value={arrToLines(draft.prompts as string[])} onChange={(e) => set('prompts', linesToArr(e.target.value))} rows={5} className={cls} />
    </>
  )
}

function FamilyFeudEditor({ draft, set }: EditorProps) {
  const surveys = (draft.surveys as { question: string; answers: { text: string; count: number }[] }[]) ?? []
  function setS(i: number, patch: Partial<{ question: string; answers: { text: string; count: number }[] }>) { set('surveys', surveys.map((s, j) => (j === i ? { ...s, ...patch } : s))) }
  function answersToText(a: { text: string; count: number }[]) { return (a ?? []).map((x) => `${x.text} | ${x.count}`).join('\n') }
  function textToAnswers(t: string) {
    return t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [text, c] = l.split('|'); return { text: (text ?? '').trim(), count: parseInt((c ?? '0').trim()) || 0 } })
  }
  return (
    <>
      <DurationField draft={draft} set={set} />
      {surveys.map((s, i) => (
        <div key={i} className="flex flex-col gap-1.5 p-2 rounded-lg border border-gray-800">
          <div className="flex gap-2">
            <input value={s.question} onChange={(e) => setS(i, { question: e.target.value })} placeholder="Question du sondage" className={cls} />
            <button onClick={() => set('surveys', surveys.filter((_, j) => j !== i))} className="text-red-400 text-xs shrink-0">retirer</button>
          </div>
          <span className="text-xs text-gray-500">Réponses « texte | popularité » (une par ligne)</span>
          <textarea value={answersToText(s.answers)} onChange={(e) => setS(i, { answers: textToAnswers(e.target.value) })} rows={4} className={cls} />
        </div>
      ))}
      <button onClick={() => set('surveys', [...surveys, { question: '', answers: [] }])} className="self-start text-violet-400 text-xs">+ sondage</button>
    </>
  )
}

function JustePrixEditor({ draft, set, gameId }: EditorProps & { gameId: Id<'games'> }) {
  const items = (draft.items as { label: string; price: number; trapNote?: string; imageUrl?: string; imageStorageId?: string }[]) ?? []
  const generateUploadUrl = useMutation(api.players.generateUploadUrl)
  const [uploading, setUploading] = useState<number | null>(null)
  function setItem(i: number, patch: Partial<{ label: string; price: number; trapNote: string; imageUrl: string; imageStorageId: string }>) { set('items', items.map((it, j) => (j === i ? { ...it, ...patch } : it))) }

  async function upload(i: number, file: File) {
    setUploading(i)
    try {
      const url = await generateUploadUrl()
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      const { storageId } = await res.json()
      setItem(i, { imageStorageId: storageId, imageUrl: '' })
    } finally { setUploading(null) }
  }

  return (
    <>
      <DurationField draft={draft} set={set} />
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-1.5 p-2 rounded-lg border border-gray-800">
          <div className="flex gap-2">
            <input value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Objet" className={cls} />
            <input type="number" value={it.price} onChange={(e) => setItem(i, { price: parseFloat(e.target.value) || 0 })} placeholder="Prix €" className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm" />
            <button onClick={() => set('items', items.filter((_, j) => j !== i))} className="text-red-400 text-xs shrink-0">✕</button>
          </div>
          <input value={it.trapNote ?? ''} onChange={(e) => setItem(i, { trapNote: e.target.value })} placeholder="Note / piège (optionnel)" className={cls} />
          <div className="flex items-center gap-2">
            <input value={it.imageUrl ?? ''} onChange={(e) => setItem(i, { imageUrl: e.target.value, imageStorageId: '' })} placeholder="URL d'image (ou upload →)" className={cls} />
            <label className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-xs cursor-pointer shrink-0 hover:bg-gray-700">
              {uploading === i ? '…' : (it.imageStorageId ? '✓ photo' : '📷')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(i, f) }} />
            </label>
          </div>
        </div>
      ))}
      <button onClick={() => set('items', [...items, { label: '', price: 0 }])} className="self-start text-violet-400 text-xs">+ objet</button>
    </>
  )
}
