import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Quiz Night',
  description: 'Le jeu du vendredi soir',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-white min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
