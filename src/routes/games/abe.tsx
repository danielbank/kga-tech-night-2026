import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/abe')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'abe')!

const STORAGE_KEY = 'abe-minecraft'
const LANE_WIDTH = 320
const LANE_HEIGHT = 220
const PLAYER_SIZE = 40
const CREEPER_SIZE = 36
const CREEPER_SPEED = 2.2
const SPAWN_INTERVAL_MS = 1300
const HEARTS = 3

function GameComponent() {
  const [playerX, setPlayerX] = useState(LANE_WIDTH / 2 - PLAYER_SIZE / 2)
  const [creepers, setCreepers] = useState<
    { id: number; x: number; y: number }[]
  >([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [hearts, setHearts] = useState(HEARTS)
  const [gameOver, setGameOver] = useState(false)
  const [playing, setPlaying] = useState(false)
  const creeperIdRef = useRef(0)
  const nextSpawnRef = useRef(0)

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-highScore`)
    if (saved) setHighScore(parseInt(saved, 10) || 0)
  }, [])

  const startGame = useCallback(() => {
    setPlayerX(LANE_WIDTH / 2 - PLAYER_SIZE / 2)
    setCreepers([])
    setScore(0)
    setHearts(HEARTS)
    setGameOver(false)
    setPlaying(true)
    creeperIdRef.current = 0
    nextSpawnRef.current = Date.now() + SPAWN_INTERVAL_MS
  }, [])

  // Game loop: move creepers and spawn new ones
  useEffect(() => {
    if (!playing || gameOver) return

    const tick = () => {
      const now = Date.now()

      setCreepers((prev) => {
        const updated = prev
          .map((c) => ({ ...c, y: c.y + CREEPER_SPEED }))
          .filter((c) => c.y < LANE_HEIGHT)
        const passed = prev.length - updated.length
        if (passed > 0) setScore((s) => s + passed)
        return updated
      })

      if (now >= nextSpawnRef.current) {
        nextSpawnRef.current = now + SPAWN_INTERVAL_MS
        const maxX = LANE_WIDTH - CREEPER_SIZE
        setCreepers((prev) => [
          ...prev,
          {
            id: ++creeperIdRef.current,
            x: Math.random() * maxX,
            y: -CREEPER_SIZE,
          },
        ])
      }
    }

    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [playing, gameOver])

  // Collision: player vs creepers — lose a heart
  useEffect(() => {
    if (!playing || gameOver || hearts <= 0) return

    const playerLeft = playerX
    const playerRight = playerX + PLAYER_SIZE
    const playerTop = LANE_HEIGHT - PLAYER_SIZE - 10
    const playerBottom = LANE_HEIGHT - 10

    const hit = creepers.some((c) => {
      const cLeft = c.x
      const cRight = c.x + CREEPER_SIZE
      const cTop = c.y
      const cBottom = c.y + CREEPER_SIZE
      return (
        playerRight > cLeft &&
        playerLeft < cRight &&
        playerBottom > cTop &&
        playerTop < cBottom
      )
    })

    if (hit) {
      setHearts((h) => h - 1)
      setCreepers((prev) =>
        prev.filter((c) => {
          const cLeft = c.x
          const cRight = c.x + CREEPER_SIZE
          const cBottom = c.y + CREEPER_SIZE
          return !(
            playerRight > cLeft &&
            playerLeft < cRight &&
            playerBottom > c.y &&
            playerTop < cBottom
          )
        })
      )
      if (hearts <= 1) {
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
    }
  }, [playing, gameOver, playerX, creepers, hearts, highScore])

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

  // Game over when hearts hit 0 (handled in collision, but also sync state)
  useEffect(() => {
    if (hearts <= 0 && playing) {
      setGameOver(true)
      setPlaying(false)
    }
  }, [hearts, playing])

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

      <div className="rounded-xl border border-amber-900/40 bg-stone-900/50 p-6 shadow-inner">
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Dodge the creepers! You have 3 hearts. Use ← and → to move.
        </p>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-4">
          <span className="flex gap-0.5 text-2xl" aria-label={`${hearts} hearts`}>
            {Array.from({ length: HEARTS }, (_, i) => (
              <span key={i} role="img" aria-hidden>
                {i < hearts ? '❤️' : '🖤'}
              </span>
            ))}
          </span>
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
            No hearts left! Final score: {score}
          </div>
        )}

        <div
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-amber-800/60 bg-gradient-to-b from-sky-900/50 to-green-900/40 shadow-inner"
          style={{ width: LANE_WIDTH, height: LANE_HEIGHT }}
          tabIndex={0}
        >
          {/* Grass strip at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-8 border-t-2 border-green-700/80 bg-green-800/70"
            aria-hidden
          />
          {/* Player (sword) */}
          <div
            className="absolute flex items-center justify-center text-3xl transition-[left] duration-75"
            style={{
              left: playerX,
              top: LANE_HEIGHT - PLAYER_SIZE - 18,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
            }}
            role="img"
            aria-label="You"
          >
            ⚔️
          </div>
          {/* Creepers */}
          {creepers.map((c) => (
            <div
              key={c.id}
              className="absolute flex items-center justify-center rounded border-2 border-green-900/80 bg-green-700 text-xl"
              style={{
                left: c.x,
                top: c.y,
                width: CREEPER_SIZE,
                height: CREEPER_SIZE,
              }}
              role="img"
              aria-hidden
            >
              💚
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
