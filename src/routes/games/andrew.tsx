import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/andrew')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'andrew')!

const STORAGE_KEY = 'andrew-racing'
const LANES = 3
const LANE_WIDTH_PCT = 100 / LANES
const TICK_MS = 50
const OBSTACLE_SPAWN_INTERVAL = 120
const ROAD_STRIPE_HEIGHT = 24

type GameStatus = 'idle' | 'playing' | 'crashed'

interface Obstacle {
  id: number
  lane: number
  y: number
}

function GameComponent() {
  const [status, setStatus] = useState<GameStatus>('idle')
  const [playerLane, setPlayerLane] = useState(1)
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [roadOffset, setRoadOffset] = useState(0)
  const obstacleIdRef = useRef(0)
  const tickRef = useRef(0)
  const scoreRef = useRef(0)
  const gameAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-highScore`)
    if (saved) setHighScore(parseInt(saved, 10) || 0)
  }, [])

  const spawnObstacle = useCallback(() => {
    const lane = Math.floor(Math.random() * LANES)
    obstacleIdRef.current += 1
    setObstacles((prev) => [...prev, { id: obstacleIdRef.current, lane, y: 0 }])
  }, [])

  const playerLaneRef = useRef(playerLane)
  playerLaneRef.current = playerLane

  useEffect(() => {
    if (status !== 'playing') return
    const interval = setInterval(() => {
      setRoadOffset((o) => (o + 8) % (ROAD_STRIPE_HEIGHT * 2))
      setScore((s) => {
        const next = s + 1
        scoreRef.current = next
        return next
      })
      setObstacles((prev) => {
        const updated = prev
          .map((obs) => ({ ...obs, y: obs.y + 6 }))
          .filter((obs) => obs.y < 100)
        const hit = updated.some(
          (obs) =>
            obs.lane === playerLaneRef.current && obs.y >= 65 && obs.y <= 85
        )
        if (hit) {
          setStatus('crashed')
          setHighScore((h) => {
            const newHigh = Math.max(h, scoreRef.current)
            localStorage.setItem(`${STORAGE_KEY}-highScore`, String(newHigh))
            return newHigh
          })
        }
        return updated
      })
      tickRef.current += 1
      if (tickRef.current % OBSTACLE_SPAWN_INTERVAL === 0) spawnObstacle()
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [status, spawnObstacle])

  useEffect(() => {
    if (status !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')
        setPlayerLane((l) => (l > 0 ? l - 1 : l))
      if (e.key === 'ArrowRight')
        setPlayerLane((l) => (l < LANES - 1 ? l + 1 : l))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status])

  const start = () => {
    setStatus('playing')
    setPlayerLane(1)
    setObstacles([])
    setScore(0)
    setRoadOffset(0)
    tickRef.current = 0
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 text-center">
        <span className="text-6xl" role="img" aria-hidden>{game.emoji}</span>
        <h1 className="mt-4 text-2xl font-bold">{game.name}'s Racing Game</h1>
        <p className="mt-1 text-muted-foreground">
          {game.grade} Grade · {game.teacher}
        </p>
      </header>

      <div className="rounded-xl border border-muted-foreground/30 bg-muted/30 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-muted-foreground/30 bg-muted/50 px-4 py-2">
          <div className="text-sm font-medium">
            Score: <span className="tabular-nums">{score}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Best: <span className="tabular-nums font-medium text-foreground">{highScore}</span>
          </div>
        </div>

        <div
          ref={gameAreaRef}
          className="relative h-[320px] overflow-hidden bg-neutral-800"
        >
          {/* Road */}
          <div
            className="absolute inset-0 flex flex-col"
            style={{
              background: `repeating-linear-gradient(
                to bottom,
                transparent 0px,
                transparent ${ROAD_STRIPE_HEIGHT}px,
                rgba(255,255,255,0.4) ${ROAD_STRIPE_HEIGHT}px,
                rgba(255,255,255,0.4) ${ROAD_STRIPE_HEIGHT * 2}px
              )`,
              backgroundPositionY: `${roadOffset}px`,
            }}
          >
            <div className="absolute left-[10%] right-[10%] top-0 bottom-0 bg-neutral-700" />
          </div>

          {/* Lanes */}
          <div className="absolute left-[10%] right-[10%] top-0 bottom-0 flex">
            {Array.from({ length: LANES }).map((_, i) => (
              <div
                key={i}
                className="border-x border-dashed border-white/20"
                style={{ width: `${100 / LANES}%` }}
              />
            ))}
          </div>

          {/* Obstacles */}
          {obstacles.map((obs) => (
            <div
              key={obs.id}
              className="absolute left-[10%] rounded bg-red-600 opacity-90 transition-none"
              style={{
                width: `${LANE_WIDTH_PCT * 0.7}%`,
                left: `calc(10% + ${obs.lane * LANE_WIDTH_PCT + (LANE_WIDTH_PCT * 0.15)}%)`,
                top: `${obs.y}%`,
                height: '14%',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              <div className="flex h-full items-center justify-center text-white/80 text-[10px] font-bold">
                🚗
              </div>
            </div>
          ))}

          {/* Player car */}
          <div
            className="absolute left-[10%] rounded-lg bg-emerald-500 transition-all duration-75 ease-out"
            style={{
              width: `${LANE_WIDTH_PCT * 0.7}%`,
              left: `calc(10% + ${playerLane * LANE_WIDTH_PCT + (LANE_WIDTH_PCT * 0.15)}%)`,
              top: '72%',
              height: '14%',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex h-full items-center justify-center text-white text-lg">
              🏎️
            </div>
          </div>

          {/* Overlays */}
          {status === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
              <p className="text-lg font-medium">Press Start to Race!</p>
              <p className="mt-2 text-sm text-white/80">← → arrow keys to move</p>
              <Button onClick={start} className="mt-6">
                Start Race
              </Button>
            </div>
          )}
          {status === 'crashed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
              <p className="text-xl font-bold">💥 Crash!</p>
              <p className="mt-2">Score: {score}</p>
              {score >= highScore && score > 0 && (
                <p className="mt-1 text-sm text-yellow-300">New best!</p>
              )}
              <Button onClick={start} className="mt-6">
                Race Again
              </Button>
            </div>
          )}
        </div>
      </div>
      {status === 'playing' && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          ← → arrow keys to switch lanes
        </p>
      )}
    </div>
  )
}
