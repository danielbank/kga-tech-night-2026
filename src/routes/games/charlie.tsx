import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/charlie')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'charlie')!

const LANES = 3
const STORAGE_KEY = 'charlie-racing-highscore'

type Lane = 0 | 1 | 2

function GameComponent() {
  const [lane, setLane] = useState<Lane>(1)
  const [obstacles, setObstacles] = useState<{ lane: Lane; y: number; id: number }[]>([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [obstacleId, setObstacleId] = useState(0)
  const tickRef = useRef<number>(0)
  const prevTimeRef = useRef<number>(0)
  const scoreRef = useRef(0)
  scoreRef.current = score

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setHighScore(parseInt(saved, 10) || 0)
  }, [])

  const spawnObstacle = useCallback(() => {
    const lane = Math.floor(Math.random() * LANES) as Lane
    setObstacles((o) => [...o, { lane, y: 0, id: obstacleId }])
    setObstacleId((i) => i + 1)
  }, [obstacleId])

  const gameLoop = useCallback(
    (time: number) => {
      if (!playing || gameOver) return
      const dt = Math.min((time - prevTimeRef.current) / 1000, 0.1)
      prevTimeRef.current = time

      setObstacles((prev) => {
        const next = prev
          .map((o) => ({ ...o, y: o.y + 120 * dt }))
          .filter((o) => o.y < 100)
        return next
      })

      tickRef.current += dt
      if (tickRef.current > 1.2) {
        tickRef.current = 0
        spawnObstacle()
      }

      setScore((s) => s + Math.round(60 * dt))
    },
    [playing, gameOver, spawnObstacle]
  )

  useEffect(() => {
    if (!playing || gameOver) return
    prevTimeRef.current = performance.now()
    let id: number
    const loop = (time: number) => {
      gameLoop(time)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [playing, gameOver, gameLoop])

  useEffect(() => {
    if (!playing || gameOver) return
    const check = () => {
      const carZoneTop = 78
      const carZoneBottom = 98
      const hit = obstacles.some(
        (o) => o.lane === lane && o.y >= carZoneTop && o.y <= carZoneBottom
      )
      if (hit) {
        setGameOver(true)
        const finalScore = scoreRef.current
        setHighScore((h) => {
          const next = Math.max(h, finalScore)
          localStorage.setItem(STORAGE_KEY, String(next))
          return next
        })
      }
    }
    const id = setInterval(check, 50)
    return () => clearInterval(id)
  }, [obstacles, lane, playing, gameOver])

  useEffect(() => {
    if (!playing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault()
        setLane((l) => (l > 0 ? ((l - 1) as Lane) : l))
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault()
        setLane((l) => (l < LANES - 1 ? ((l + 1) as Lane) : l))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playing])

  const start = () => {
    setLane(1)
    setObstacles([])
    setScore(0)
    setGameOver(false)
    setPlaying(true)
    tickRef.current = 0
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 text-center">
        <span className="text-6xl" role="img" aria-hidden>
          {game.emoji}
        </span>
        <h1 className="mt-4 text-2xl font-bold">{game.name}&apos;s Racing Game</h1>
        <p className="mt-1 text-muted-foreground">
          {game.grade} Grade · {game.teacher}
        </p>
      </header>

      <div className="rounded-xl border border-muted-foreground/30 bg-muted/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-4 font-mono">
            <span>Score: {score}</span>
            <span className="text-muted-foreground">Best: {highScore}</span>
          </div>
          {!playing && (
            <Button onClick={start}>{gameOver ? 'Play Again' : 'Start Race'}</Button>
          )}
        </div>

        {gameOver && (
          <div className="mb-3 rounded-lg bg-destructive/20 p-3 text-center font-medium text-destructive">
            Crash! Final score: {score}
          </div>
        )}

        <div
          className="relative mx-auto aspect-[3/4] max-h-[400px] overflow-hidden rounded-lg bg-slate-800"
          style={{ maxWidth: 200 }}
        >
          {/* road lanes */}
          <div className="absolute inset-0 flex">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex-1 border-r border-slate-600 last:border-r-0"
              />
            ))}
          </div>

          {/* center lines */}
          <div className="absolute left-1/3 top-0 h-full w-0.5 border-l border-dashed border-yellow-500/60" />
          <div className="absolute left-2/3 top-0 h-full w-0.5 border-l border-dashed border-yellow-500/60" />

          {/* obstacles */}
          {obstacles.map((o) => (
            <div
              key={o.id}
              className="absolute left-0 top-0 flex justify-center transition-none"
              style={{
                transform: `translate(${o.lane * 33.33 + 16.66}%, ${o.y}%)`,
                width: '33.33%',
              }}
            >
              <span className="text-3xl" role="img" aria-label="Obstacle car">
                🚙
              </span>
            </div>
          ))}

          {/* player car */}
          <div
            className="absolute bottom-[8%] left-0 flex justify-center transition-transform duration-100"
            style={{
              transform: `translate(${lane * 33.33 + 16.66}%, 0)`,
              width: '33.33%',
            }}
          >
            <span className="text-4xl" role="img" aria-label="Your car">
              🚗
            </span>
          </div>
        </div>

        <p className="mt-3 text-center text-sm text-muted-foreground">
          ← → or A D to switch lanes. Don&apos;t crash!
        </p>
      </div>
    </div>
  )
}
