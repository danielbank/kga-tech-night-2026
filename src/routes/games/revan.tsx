import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/revan')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'revan')!

const STORAGE_KEY = 'revan-bus-escape'
const GAME_WIDTH = 380
const GAME_HEIGHT = 220
const PLAYER_X = 72
const PLAYER_WIDTH = 36
const PLAYER_HEIGHT = 44
const PLAYER_DUCK_HEIGHT = 24
const GROUND_Y = GAME_HEIGHT - 56
const GRAVITY = 0.9
const JUMP_STRENGTH = -14
const SCROLL_SPEED = 4
const SPAWN_INTERVAL_MS = 1600
const ROCK_HEIGHT = 28
const ROCK_WIDTH = 32
const TUNNEL_HEIGHT = 70
const TUNNEL_WIDTH = 48

type ObstacleType = 'rock' | 'tunnel'
type Obstacle = {
  id: number
  type: ObstacleType
  x: number
}

function GameComponent() {
  const [playerY, setPlayerY] = useState(GROUND_Y - PLAYER_HEIGHT)
  const [velocityY, setVelocityY] = useState(0)
  const [ducking, setDucking] = useState(false)
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [playing, setPlaying] = useState(false)
  const obstacleIdRef = useRef(0)
  const nextSpawnRef = useRef(0)
  const velocityYRef = useRef(0)
  const playerYRef = useRef(GROUND_Y - PLAYER_HEIGHT)

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-highScore`)
    if (saved) setHighScore(parseInt(saved, 10) || 0)
  }, [])

  const startGame = useCallback(() => {
    const startY = GROUND_Y - PLAYER_HEIGHT
    setPlayerY(startY)
    setVelocityY(0)
    velocityYRef.current = 0
    playerYRef.current = startY
    setDucking(false)
    setObstacles([])
    setScore(0)
    setGameOver(false)
    setPlaying(true)
    obstacleIdRef.current = 0
    nextSpawnRef.current = Date.now() + SPAWN_INTERVAL_MS
  }, [])

  // Game loop: scroll obstacles, spawn new ones, gravity & jump
  useEffect(() => {
    if (!playing || gameOver) return

    const tick = () => {
      const now = Date.now()
      const playerH = ducking ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT
      const groundTop = GROUND_Y - playerH

      // Gravity and vertical position
      velocityYRef.current += GRAVITY
      playerYRef.current += velocityYRef.current
      if (playerYRef.current >= groundTop) {
        playerYRef.current = groundTop
        velocityYRef.current = 0
      }
      setPlayerY(playerYRef.current)
      setVelocityY(velocityYRef.current)

      // Move obstacles left
      setObstacles((prev) => {
        const updated = prev
          .map((o) => ({ ...o, x: o.x - SCROLL_SPEED }))
          .filter((o) => o.x > -TUNNEL_WIDTH - 20)
        const passed = prev.length - updated.length
        if (passed > 0) setScore((s) => s + passed)
        return updated
      })

      // Spawn
      if (now >= nextSpawnRef.current) {
        nextSpawnRef.current = now + SPAWN_INTERVAL_MS
        const type: ObstacleType = Math.random() < 0.5 ? 'rock' : 'tunnel'
        setObstacles((prev) => [
          ...prev,
          { id: ++obstacleIdRef.current, type, x: GAME_WIDTH },
        ])
      }
    }

    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [playing, gameOver, ducking])

  // Collision: rock = must be jumping; tunnel = must be ducking
  useEffect(() => {
    if (!playing || gameOver) return

    const playerH = ducking ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT
    const playerTop = playerY
    const playerBottom = playerY + playerH
    const playerLeft = PLAYER_X
    const playerRight = PLAYER_X + PLAYER_WIDTH

    const hit = obstacles.some((o) => {
      if (o.type === 'rock') {
        const rockLeft = o.x
        const rockRight = o.x + ROCK_WIDTH
        const rockTop = GROUND_Y - ROCK_HEIGHT
        const overlapX = playerRight > rockLeft && playerLeft < rockRight
        if (!overlapX) return false
        // Hit if player didn't jump: player bottom is at or below rock top
        return playerBottom >= rockTop - 4 && playerBottom <= GROUND_Y + 4
      } else {
        const tunnelLeft = o.x
        const tunnelRight = o.x + TUNNEL_WIDTH
        const tunnelBottom = TUNNEL_HEIGHT
        const overlapX = playerRight > tunnelLeft && playerLeft < tunnelRight
        if (!overlapX) return false
        // Hit if not ducking and head would hit tunnel (player top < tunnel bottom)
        return !ducking && playerTop < tunnelBottom + 8
      }
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
  }, [playing, gameOver, playerY, ducking, obstacles, highScore])

  // Jump (Space / ArrowUp) and Duck (ArrowDown / S)
  useEffect(() => {
    if (!playing || gameOver) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault()
        const onGround =
          playerYRef.current >= GROUND_Y - PLAYER_HEIGHT - 4 &&
          !ducking
        if (onGround) {
          velocityYRef.current = JUMP_STRENGTH
          setVelocityY(JUMP_STRENGTH)
        }
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setDucking(e.type === 'keydown')
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [playing, gameOver, ducking])

  const isOnGround =
    playerY >= GROUND_Y - (ducking ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT) - 2

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
          Escape the bus! Jump over rocks (↑ / Space) and duck under tunnels
          (↓ / S).
        </p>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-4">
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
            Crash! Final score: {score}
          </div>
        )}

        <div
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-amber-800/60 bg-gradient-to-b from-sky-300/30 to-amber-900/50 shadow-inner"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          tabIndex={0}
        >
          {/* Sky / road strip */}
          <div
            className="absolute bottom-0 left-0 right-0 h-14 border-t-2 border-amber-800/80 bg-amber-900/70"
            aria-hidden
          />
          {/* Bus silhouette (background) */}
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2 text-5xl opacity-40"
            role="img"
            aria-hidden
          >
            🚌
          </div>
          {/* Player (runner) */}
          <div
            className="absolute flex items-center justify-center text-2xl transition-[top] duration-75"
            style={{
              left: PLAYER_X,
              top: playerY,
              width: PLAYER_WIDTH,
              height: ducking ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT,
            }}
            role="img"
            aria-label={ducking ? 'Ducking' : isOnGround ? 'Running' : 'Jumping'}
          >
            {ducking ? '🧎' : '🏃'}
          </div>
          {/* Obstacles */}
          {obstacles.map((o) =>
            o.type === 'rock' ? (
              <div
                key={o.id}
                className="absolute flex items-center justify-center rounded border-2 border-stone-700 bg-stone-600 text-lg"
                style={{
                  left: o.x,
                  top: GROUND_Y - ROCK_HEIGHT,
                  width: ROCK_WIDTH,
                  height: ROCK_HEIGHT,
                }}
                role="img"
                aria-hidden
              >
                🪨
              </div>
            ) : (
              <div
                key={o.id}
                className="absolute left-0 right-0 flex items-center justify-center border-b-4 border-stone-700 bg-stone-800/90 text-2xl"
                style={{
                  left: o.x,
                  top: 0,
                  width: TUNNEL_WIDTH,
                  height: TUNNEL_HEIGHT,
                }}
                role="img"
                aria-hidden
              >
                🚇
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
