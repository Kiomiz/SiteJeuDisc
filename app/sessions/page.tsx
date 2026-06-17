'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'quiznight_player_id'

// Pack par défaut riche : contenu volontairement abondant pour que la soirée
// soit une surprise même pour le host (qui joue aussi). Tout reste éditable
// dans /admin/session/[id].
const PETITBAC_CATEGORIES = [
  'Pays',
  'Animal',
  'Prénom',
  'Métier',
  'Ville',
  'Marque',
  'Film ou série',
  'Célébrité',
  'Plat ou aliment',
  'Objet du quotidien',
  'Champion League of Legends',
  'Artiste ou groupe de musique',
]
const DEFAULT_PACK: { type: 'petitbac' | 'fibbage' | 'quiplash' | 'familyfeud' | 'mostlikely' | 'justeprix'; title: string; config: unknown }[] = [
  {
    type: 'petitbac',
    title: 'Petit Bac',
    config: {
      durationSec: 120,
      categories: PETITBAC_CATEGORIES,
    },
  },
  {
    type: 'fibbage',
    title: 'Fibbage',
    config: {
      durationSec: 60,
      questions: [
        { text: 'Un poulpe possède ___ cœurs.', answer: '3' },
        { text: "Un escargot peut dormir jusqu'à ___ ans d'affilée.", answer: '3' },
        { text: "La Tour Eiffel peut grandir d'environ ___ cm en été à cause de la chaleur.", answer: '15' },
        { text: 'Le record du monde de hot-dogs avalés en 10 minutes est de ___ hot-dogs.', answer: '76' },
        { text: "Le nom d'origine de Google, en 1996, était ___.", answer: 'BackRub' },
        { text: "Un groupe de flamants roses s'appelle une ___.", answer: 'flamboyance' },
        { text: 'Le miel comestible le plus vieux jamais retrouvé avait environ ___ ans.', answer: '3000' },
        { text: "Le cœur d'une crevette se situe dans sa ___.", answer: 'tête' },
        { text: 'Sous leur fourrure blanche, les ours polaires ont la peau de couleur ___.', answer: 'noire' },
        { text: 'Sur Vénus, une journée dure plus longtemps qu’une ___.', answer: 'année' },
        { text: 'Le mot « anticonstitutionnellement » compte ___ lettres.', answer: '25' },
        { text: 'Le tout premier produit scanné avec un code-barres était un paquet de ___.', answer: 'chewing-gums' },
      ],
    },
  },
  {
    type: 'quiplash',
    title: 'Quiplash',
    config: {
      durationSec: 60,
      prompts: [
        'La pire chose à dire juste avant de se marier',
        'Un nom de groupe de musique vraiment nul',
        'Une mauvaise idée de cadeau pour son patron',
        'Le pire super-pouvoir possible',
        'Une excuse bidon pour ne pas aller au travail',
        'Le pire slogan pour une compagnie aérienne',
        "Une phrase qu'on ne veut PAS entendre de son chirurgien",
        'Un très mauvais nom pour un chien',
        'Une appli inutile qui devrait quand même exister',
        'Le pire parfum de glace imaginable',
        "La première chose qu'un extraterrestre dirait en arrivant sur Terre",
        "Une règle absurde à instaurer à la maison",
        'Le pire nom pour un parc d’attractions',
        'Le titre du film le plus ennuyeux du monde',
      ],
    },
  },
  {
    type: 'familyfeud',
    title: 'Une Famille en Or',
    config: {
      durationSec: 30,
      surveys: [
        {
          question: "Citez un objet qu'on emporte toujours à la plage",
          answers: [
            { text: 'Serviette', count: 38 },
            { text: 'Crème solaire', count: 27 },
            { text: 'Parasol', count: 15 },
            { text: 'Lunettes de soleil', count: 12 },
            { text: 'Glacière', count: 8 },
          ],
        },
        {
          question: "Citez quelque chose qu'on fait pour décompresser",
          answers: [
            { text: 'Regarder une série', count: 32 },
            { text: 'Dormir', count: 24 },
            { text: 'Faire du sport', count: 18 },
            { text: 'Écouter de la musique', count: 16 },
            { text: 'Manger', count: 10 },
          ],
        },
        {
          question: 'Citez un animal que l’on trouve dans une ferme',
          answers: [
            { text: 'Vache', count: 30 },
            { text: 'Poule', count: 25 },
            { text: 'Cochon', count: 20 },
            { text: 'Mouton', count: 15 },
            { text: 'Cheval', count: 10 },
          ],
        },
        {
          question: 'Citez une chose qu’on oublie souvent en partant de chez soi',
          answers: [
            { text: 'Les clés', count: 35 },
            { text: 'Le téléphone', count: 28 },
            { text: 'Le portefeuille', count: 18 },
            { text: 'Éteindre la lumière', count: 12 },
            { text: 'Le chargeur', count: 7 },
          ],
        },
        {
          question: 'Citez un ingrédient que l’on met sur une pizza',
          answers: [
            { text: 'Fromage', count: 34 },
            { text: 'Jambon', count: 24 },
            { text: 'Champignons', count: 18 },
            { text: 'Tomate', count: 14 },
            { text: 'Pepperoni', count: 10 },
          ],
        },
        {
          question: 'Citez une raison classique d’être en retard',
          answers: [
            { text: 'Réveil pas entendu', count: 30 },
            { text: 'Les bouchons', count: 26 },
            { text: 'Les transports en retard', count: 20 },
            { text: 'Rien à se mettre', count: 14 },
            { text: 'La météo', count: 10 },
          ],
        },
      ],
    },
  },
  {
    type: 'mostlikely',
    title: 'Qui est le + susceptible',
    config: {
      prompts: [
        'Qui est le plus susceptible de finir en prison ?',
        'Qui est le plus susceptible de devenir célèbre ?',
        "Qui est le plus susceptible d'oublier son propre anniversaire ?",
        'Qui est le plus susceptible de survivre à une apocalypse zombie ?',
        'Qui est le plus susceptible de pleurer devant un film Disney ?',
        'Qui est le plus susceptible de devenir millionnaire ?',
        'Qui est le plus susceptible de se perdre dans sa propre ville ?',
        'Qui est le plus susceptible de manger le dernier morceau sans demander ?',
        'Qui est le plus susceptible de répondre à un message 3 jours plus tard ?',
        'Qui est le plus susceptible de danser sur une table en soirée ?',
        'Qui est le plus susceptible de devenir influenceur ?',
        'Qui est le plus susceptible de gagner au loto et tout dépenser en une semaine ?',
      ],
    },
  },
  {
    type: 'justeprix',
    title: 'Juste Prix',
    config: {
      durationSec: 30,
      items: [
        { label: 'Un Big Mac (seul, en France)', price: 5.5, trapNote: 'Au menu, c’est bien plus cher.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Big_Mac_hamburger.jpg/960px-Big_Mac_hamburger.jpg' },
        { label: 'Une canette de Coca 50cl', price: 1.1, trapNote: 'Prix à l’unité en supermarché.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Coca-cola_50cl_can_-_Italia.jpg/960px-Coca-cola_50cl_can_-_Italia.jpg' },
        { label: 'Un pot de Nutella 825 g', price: 4.5, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Nutella_ak.jpg/960px-Nutella_ak.jpg' },
        { label: 'Un café espresso au comptoir', price: 1.2, trapNote: 'Au comptoir, pas en terrasse !', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Espresso_Coffee_01.jpg/960px-Espresso_Coffee_01.jpg' },
        { label: 'Un Rubik’s Cube officiel', price: 12, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Solved_Rubik%27s_cube.jpg/960px-Solved_Rubik%27s_cube.jpg' },
        { label: 'Des AirPods Pro (2e génération)', price: 279, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/AirPods_Pro_%282nd_generation%29.jpg/960px-AirPods_Pro_%282nd_generation%29.jpg' },
        { label: 'Une Nintendo Switch', price: 300, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Nintendo-Switch-Console-Docked-wJoyConRB.jpg/960px-Nintendo-Switch-Console-Docked-wJoyConRB.jpg' },
        { label: 'Une PlayStation 5', price: 499, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/PlayStation_5_and_DualSense.jpg/960px-PlayStation_5_and_DualSense.jpg' },
        { label: 'Un iPhone 15 Pro (128 Go)', price: 1229, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Apple_iPhone_15_Pro.jpg/960px-Apple_iPhone_15_Pro.jpg' },
        { label: 'Une Apple Watch Series 8', price: 499, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Apple_Watch_Series_8.jpg/960px-Apple_Watch_Series_8.jpg' },
        { label: 'Un aspirateur Dyson', price: 400, trapNote: 'Modèle balai sans fil.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Dyson_DC19_vacuum_cleaner.jpg' },
        { label: 'Une Tesla Model 3 (neuve)', price: 42000, trapNote: 'Prix de base neuf en France.', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Tesla_Model_3_%282023%29_IMG_9488_%28cropped%29.jpg/960px-Tesla_Model_3_%282023%29_IMG_9488_%28cropped%29.jpg' },
      ],
    },
  },
]

export default function SessionsPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<Id<'players'> | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setPlayerId(saved as Id<'players'>)
  }, [])

  const sessions = useQuery(api.sessions.list)
  const createSession = useMutation(api.sessions.create)
  const addGame = useMutation(api.sessions.addGame)
  const removeSession = useMutation(api.sessions.remove)
  const [confirmDelete, setConfirmDelete] = useState<Id<'sessions'> | null>(null)

  async function handleCreate() {
    setBusy(true)
    try {
      const sessionId = await createSession({
        name: name.trim() || `Soirée du ${new Date().toLocaleDateString('fr-FR')}`,
        hostPlayerId: playerId ?? undefined,
      })
      for (const g of DEFAULT_PACK) {
        await addGame({ sessionId, type: g.type, title: g.title, config: g.config })
      }
      router.push(`/session/${sessionId}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Soirées <span className="text-violet-400">mini-jeux</span></h1>
          <p className="text-xs text-gray-500">Enchaînement de mini-jeux entre potes</p>
        </div>
        <Link href="/" className="text-gray-500 hover:text-white text-sm">🏠</Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Nouvelle soirée</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la soirée…"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button onClick={handleCreate} disabled={busy}
            className="py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold transition-colors">
            {busy ? 'Création…' : '+ Créer (pack par défaut)'}
          </button>
          {!playerId && <p className="text-xs text-yellow-500">Astuce : choisis ton profil depuis l&apos;accueil avant, pour être host & joueur.</p>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Soirées existantes</h2>
          {sessions === undefined ? (
            <div className="h-16 rounded-xl bg-gray-800 animate-pulse" />
          ) : sessions.length === 0 ? (
            <p className="text-gray-600 text-sm italic">Aucune soirée pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((s) => (
                <div key={s._id} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-800 bg-gray-800/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.phase === 'lobby' ? 'Lobby' : s.phase === 'finished' ? 'Terminée' : 'En cours'}</p>
                  </div>
                  {confirmDelete === s._id ? (
                    <>
                      <button onClick={() => { removeSession({ sessionId: s._id }); setConfirmDelete(null) }} className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition-colors">Confirmer</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs transition-colors">✕</button>
                    </>
                  ) : (
                    <>
                      <Link href={`/session/${s._id}`} className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold transition-colors">Host</Link>
                      <Link href={`/session/${s._id}/play`} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors">Jouer</Link>
                      <button onClick={() => setConfirmDelete(s._id)} className="px-2 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs transition-colors">🗑</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
