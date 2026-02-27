import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/games/arjun-nipane')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'arjun-nipane')!

const STORAGE_KEY = 'arjun-nipane-minecraft'

const BLOCK_TYPES = [
  { id: 'dirt', emoji: '🟫', name: 'Dirt', hits: 1, points: 10, weight: 30 },
  { id: 'wood', emoji: '🪵', name: 'Wood', hits: 2, points: 20, weight: 25 },
  { id: 'stone', emoji: '🪨', name: 'Stone', hits: 2, points: 25, weight: 20 },
  { id: 'coal', emoji: '⬛', name: 'Coal', hits: 3, points: 50, weight: 12 },
  { id: 'iron', emoji: '🟠', name: 'Iron', hits: 4, points: 100, weight: 8 },
  { id: 'diamond', emoji: '💎', name: 'Diamond', hits: 5, points: 250, weight: 5 },
] as const

function pickRandomBlock() {
  const total = BLOCK_TYPES.reduce((s, b) => s + b.weight, 0)
  let r = Math.random() * total
  for (const b of BLOCK_TYPES) {
    r -= b.weight
    if (r <= 0) return b
  }
  return BLOCK_TYPES[0]
}

type Cell = {
  type: (typeof BLOCK_TYPES)[number]
  hitsLeft: number
}

function createGrid(): Cell[][] {
  return Array(4)
    .fill(null)
    .map(() =>
      Array(4)
        .fill(null)
        .map(() => {
          const type = pickRandomBlock()
          return { type, hitsLeft: type.hits }
        })
    )
}

function GameComponent() {
  const [grid, setGrid] = useState<Cell[][]>(() => {
    if (typeof window === 'undefined') return createGrid()
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Cell[][]
        if (Array.isArray(parsed) && parsed.length === 4 && parsed[0]?.length === 4) {
          return parsed.map((row) =>
            row.map((cell) => {
              const type = BLOCK_TYPES.find((t) => t.id === cell.type?.id) ?? pickRandomBlock()
              return { type, hitsLeft: cell.hitsLeft ?? type.hits }
            })
          )
        }
      }
    } catch {
      /* ignore */
    }
    return createGrid()
  })

  const [score, setScore] = useState(() => {
    if (typeof window === 'undefined') return 0
    const s = localStorage.getItem(`${STORAGE_KEY}-score`)
    return s ? parseInt(s, 10) || 0 : 0
  })

  const [highScore, setHighScore] = useState(() => {
    if (typeof window === 'undefined') return 0
    const s = localStorage.getItem(`${STORAGE_KEY}-high`)
    return s ? parseInt(s, 10) || 0 : 0
  })

  const saveGrid = useCallback((newGrid: Cell[][]) => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(newGrid))
  }, [])

  const mine = useCallback(
    (row: number, col: number) => {
      const cell = grid[row]?.[col]
      if (!cell || cell.hitsLeft <= 0) return

      const newGrid = grid.map((r, ri) =>
        r.map((c, ci) => {
          if (ri !== row || ci !== col) return c
          const hitsLeft = c.hitsLeft - 1
          if (hitsLeft > 0) return { ...c, hitsLeft }
          const type = pickRandomBlock()
          return { type, hitsLeft: type.hits }
        })
      )

      setGrid(newGrid)
      saveGrid(newGrid)

      if (cell.hitsLeft === 1) {
        const points = cell.type.points
        const newScore = score + points
        setScore(newScore)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`${STORAGE_KEY}-score`, String(newScore))
          const prevHigh = parseInt(localStorage.getItem(`${STORAGE_KEY}-high`) ?? '0', 10)
          if (newScore > prevHigh) {
            localStorage.setItem(`${STORAGE_KEY}-high`, String(newScore))
            setHighScore(newScore)
          }
        }
      }
    },
    [grid, score, saveGrid]
  )

  useEffect(() => {
    const h = localStorage.getItem(`${STORAGE_KEY}-high`)
    if (h) setHighScore(parseInt(h, 10) || 0)
  }, [score])

  const reset = useCallback(() => {
    const newGrid = createGrid()
    setGrid(newGrid)
    setScore(0)
    saveGrid(newGrid)
    if (typeof window !== 'undefined') localStorage.setItem(`${STORAGE_KEY}-score`, '0')
  }, [saveGrid])

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
        <p className="mt-2 text-sm text-muted-foreground">
          Minecraft World — mine blocks with your pickaxe. Rarer blocks give more points!
        </p>
      </header>

      {/* Sky */}
      <div className="rounded-t-xl bg-gradient-to-b from-sky-400 to-sky-600 py-6 text-center">
        <span className="text-4xl" role="img" aria-hidden>☀️</span>
        <p className="mt-2 text-sm font-medium text-sky-900/80">Your Minecraft World</p>
      </div>

      <div className="rounded-b-xl border border-t-0 border-muted-foreground/30 bg-gradient-to-b from-amber-950/20 to-stone-900/30 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-4">
            <div className="rounded-lg bg-background px-4 py-2 font-mono text-lg font-bold">
              Score: {score}
            </div>
            <div className="rounded-lg bg-amber-500/20 px-4 py-2 font-mono text-lg font-bold text-amber-700 dark:text-amber-400">
              Best: {highScore}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            New game
          </Button>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {grid.map((row, ri) =>
            row.map((cell, ci) => (
              <Button
                key={`${ri}-${ci}`}
                variant="outline"
                size="lg"
                className={cn(
                  'aspect-square min-h-0 w-full text-3xl transition-all hover:scale-105 active:scale-95',
                  cell.hitsLeft < cell.type.hits && 'opacity-90 ring-2 ring-amber-500/50'
                )}
                onClick={() => mine(ri, ci)}
                aria-label={`Mine ${cell.type.name}, ${cell.hitsLeft} hit${cell.hitsLeft === 1 ? '' : 's'} left`}
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span role="img" aria-hidden>
                    {cell.type.emoji}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {cell.hitsLeft}/{cell.type.hits}
                  </span>
                </span>
              </Button>
            ))
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          🟫 Dirt · 🪵 Wood · 🪨 Stone · ⬛ Coal · 🟠 Iron · 💎 Diamond
        </p>
      </div>
    </div>
  )
}
