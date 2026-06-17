'use client'

import { useEffect, useState } from 'react'

export type PlayerLite = { _id: string; pseudo: string; avatar: string; color: string; photoUrl?: string | null }

export function Avatar({ p, size = 28 }: { p?: PlayerLite | null; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{ width: size, height: size, backgroundColor: p?.color ?? '#6b7280', fontSize: size * 0.5 }}
    >
      {p?.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : (p?.avatar ?? '?')}
    </div>
  )
}

/** Secondes restantes avant `deadline` (timestamp ms), ou null si pas de deadline. */
export function useCountdown(deadline?: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  if (!deadline) return null
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function eur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)
}

/** Sélecteur de points pour la correction host : boutons rapides + saisie libre. */
export function PointsPicker({ value, onSet, options = [0, 1, 2, 3] }: { value: number; onSet: (n: number) => void; options?: number[] }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {options.map((o) => (
        <button key={o} onClick={() => onSet(o)}
          className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${value === o ? 'bg-violet-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
          {o}
        </button>
      ))}
      <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onSet(parseFloat(e.target.value) || 0)}
        className="w-14 h-8 px-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm text-center focus:outline-none focus:border-violet-500" />
    </div>
  )
}
