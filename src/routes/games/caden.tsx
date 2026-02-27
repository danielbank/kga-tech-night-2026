import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/caden')({
  component: CadenGame,
})

const game = games.find((g) => g.slug === 'caden')!

function CadenGame() {
  const [score, setScore] = useState(0)

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 text-center">
        <span className="text-6xl" role="img" aria-hidden>
          {game.emoji}
        </span>
        <h1 className="mt-4 text-2xl font-bold">{game.name}&apos;s Game</h1>
        <p className="mt-1 text-muted-foreground">
          {game.grade} Grade · {game.teacher}
        </p>
      </header>

      <div className="rounded-xl border border-muted-foreground/30 bg-muted/30 p-6">
        <div className="flex flex-col items-center gap-6">
          <p className="text-muted-foreground">Tap the cowboy to score!</p>
          <Button
            size="lg"
            className="text-4xl"
            onClick={() => setScore((s) => s + 1)}
            aria-label="Score a point"
          >
            🤠 Score: {score}
          </Button>
        </div>
      </div>
    </div>
  )
}
