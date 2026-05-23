'use client'

import { useState, useRef } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

const AVATARS = [
  '😎', '🤠', '🥸', '🧐', '😈', '👻',
  '🐶', '🐱', '🦊', '🐸', '🐼', '🦁',
  '🌵', '🍄', '⭐', '🔥', '💎', '🎮',
  '🍕', '🎸', '🚀', '🎯', '🎲', '👑',
]

const COLORS = [
  '#6d28d9', '#7c3aed', '#2563eb', '#0891b2',
  '#059669', '#65a30d', '#d97706', '#dc2626',
  '#db2777', '#9333ea', '#0f172a', '#374151',
]

interface Props {
  onClose: () => void
}

export function CreatePlayerModal({ onClose }: Props) {
  const [pseudo, setPseudo] = useState('')
  const [avatar, setAvatar] = useState('😎')
  const [color, setColor] = useState('#6d28d9')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const createPlayer = useMutation(api.players.create)
  const generateUploadUrl = useMutation(api.players.generateUploadUrl)

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pseudo.trim()) return setError('Le pseudo est requis')
    setLoading(true)
    setError('')
    try {
      let photoStorageId = undefined
      if (photoFile) {
        const uploadUrl = await generateUploadUrl()
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': photoFile.type },
          body: photoFile,
        })
        const { storageId } = await res.json()
        photoStorageId = storageId
      }
      await createPlayer({ pseudo: pseudo.trim(), avatar, color, photoStorageId })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-5">Créer ton profil</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shrink-0"
              style={{ backgroundColor: color }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                avatar
              )}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-lg">{pseudo || 'Pseudo'}</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs text-violet-400 hover:text-violet-300 mt-1"
              >
                {photoPreview ? 'Changer la photo' : '+ Ajouter une photo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>
          </div>

          {/* Pseudo */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Pseudo</label>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              maxLength={20}
              placeholder="Ex: MegaZurb"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Avatar</label>
            <div className="grid grid-cols-8 gap-1">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`text-xl p-1 rounded-lg transition-all ${
                    avatar === a ? 'bg-violet-700 scale-110' : 'hover:bg-gray-700'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
