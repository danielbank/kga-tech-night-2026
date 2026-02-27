import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/ariha')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'ariha')!

const STORAGE_KEY = 'ariha-obstacle'
const LANE_WIDTH = 320
const LANE_HEIGHT = 200
const PLAYER_SIZE = 36
const OBSTACLE_SIZE = 32
const OBSTACLE_SPEED = 2
const SPAWN_INTERVAL_MS = 1500

function GameComponent() {
  const [playerX, setPlayerX] = useState(LANE_WIDTH / 2 - PLAYER_SIZE / 2)
  const [obstacles, setObstacles] = useState<{ id: number; x: number; y: number }[]>([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [playing, setPlaying] = useState(false)
  const obstacleIdRef = useRef(0)
  const nextSpawnRef = useRef(0)

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-highScore`)
    if (saved) setHighScore(parseInt(saved, 10) || 0)
  }, [])

  const startGame = useCallback(() => {
    setPlayerX(LANE_WIDTH / 2 - PLAYER_SIZE / 2)
    setObstacles([])
    setScore(0)
    setGameOver(false)
    setPlaying(true)
    obstacleIdRef.current = 0
    nextSpawnRef.current = Date.now() + SPAWN_INTERVAL_MS
  }, [])

  // Game loop: move obstacles and spawn new ones
  useEffect(() => {
    if (!playing || gameOver) return

    const tick = () => {
      const now = Date.now()

      setObstacles((prev) => {
        const updated = prev
          .map((o) => ({ ...o, y: o.y + OBSTACLE_SPEED }))
          .filter((o) => o.y < LANE_HEIGHT)
        const passed = prev.length - updated.length
        if (passed > 0) setScore((s) => s + passed)
        return updated
      })

      if (now >= nextSpawnRef.current) {
        nextSpawnRef.current = now + SPAWN_INTERVAL_MS
        const maxX = LANE_WIDTH - OBSTACLE_SIZE
        setObstacles((prev) => [
          ...prev,
          {
            id: ++obstacleIdRef.current,
            x: Math.random() * maxX,
            y: -OBSTACLE_SIZE,
          },
        ])
      }
    }

    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [playing, gameOver])

  // Collision: player vs obstacles
  useEffect(() => {
    if (!playing || gameOver) return

    const playerLeft = playerX
    const playerRight = playerX + PLAYER_SIZE
    const playerTop = LANE_HEIGHT - PLAYER_SIZE - 8
    const playerBottom = LANE_HEIGHT - 8

    const hit = obstacles.some((o) => {
      const oLeft = o.x
      const oRight = o.x + OBSTACLE_SIZE
      const oTop = o.y
      const oBottom = o.y + OBSTACLE_SIZE
      return (
        playerRight > oLeft &&
        playerLeft < oRight &&
        playerBottom > oTop &&
        playerTop < oBottom
      )
    })

    if (hit) {
      setGameOver(true)
      setPlaying(false)
      setScore((s) => {
        if (s > highScore) {
          setHighScore(s)
          localStorage.setItem(`${STORAGE_KEY}-highScore`, String(s))
        }
        return s
      })
    }
  }, [playing, gameOver, playerX, obstacles, highScore])

  // Arrow keys to move
  useEffect(() => {
    if (!playing || gameOver) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPlayerX((x) => Math.max(0, x - 14))
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPlayerX((x) => Math.min(LANE_WIDTH - PLAYER_SIZE, x + 14))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, gameOver])

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
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Dodge the rocks! Use ← and → arrow keys to move.
        </p>
        <div className="mb-4 flex items-center justify-center gap-4">
          <span className="rounded-lg bg-background px-4 py-2 font-mono font-bold">
            Score: {score}
          </span>
          <span className="rounded-lg bg-background px-4 py-2 font-mono text-muted-foreground">
            Best: {highScore}
          </span>
          {!playing && (
            <Button onClick={startGame}>
              {gameOver ? 'Play Again' : 'Start'}
            </Button>
          )}
        </div>

        {gameOver && (
          <div className="mb-4 rounded-lg bg-destructive/20 p-3 text-center text-sm font-medium text-destructive">
            Oops! You hit an obstacle. Final score: {score}
          </div>
        )}

        <div
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-amber-900/50 bg-sky-900/40 shadow-inner"
          style={{ width: LANE_WIDTH, height: LANE_HEIGHT }}
          tabIndex={0}
        >
          {/* Player (heart) */}
          <div
            className="absolute flex items-center justify-center text-3xl transition-[left] duration-75"
            style={{
              left: playerX,
              top: LANE_HEIGHT - PLAYER_SIZE - 8,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
            }}
            role="img"
            aria-label="You"
          >
            ❤️
          </div>
          {/* Obstacles (rocks) */}
          {obstacles.map((o) => (
            <div
              key={o.id}
              className="absolute flex items-center justify-center text-2xl"
              style={{
                left: o.x,
                top: o.y,
                width: OBSTACLE_SIZE,
                height: OBSTACLE_SIZE,
              }}
              role="img"
              aria-hidden
            >
              🪨
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
