import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/shankar')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'shankar')!

const STORAGE_KEY = 'shankar-mine-defend'
const GRID_COLS = 6
const GRID_ROWS = 4
const BLOCK_SIZE = 44
const GAME_WIDTH = GRID_COLS * BLOCK_SIZE
const GAME_HEIGHT = GRID_ROWS * BLOCK_SIZE + 56
const DAY_DURATION_MS = 26000
const NIGHT_DURATION_MS = 18000
const ZOMBIE_SPAWN_INTERVAL_MS = 1100
const ZOMBIE_SPEED = 1.4
const ZOMBIE_SIZE = 36
const PLAYER_Y = GAME_HEIGHT - 50
const PLAYER_SIZE = 40
const SWORD_RANGE = 52
const SWORD_COOLDOWN_MS = 400
const HEARTS = 3

type Phase = 'day' | 'night'

function GameComponent() {
  const [phase, setPhase] = useState<Phase>('day')
  const [phaseEndTime, setPhaseEndTime] = useState(0)
  const [blocks, setBlocks] = useState<(0 | 1 | 2)[][]>([])
  const [zombies, setZombies] = useState<{ id: number; x: number; y: number }[]>([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [hearts, setHearts] = useState(HEARTS)
  const [gameOver, setGameOver] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [swordSwinging, setSwordSwinging] = useState(false)
  const zombieIdRef = useRef(0)
  const nextZombieSpawnRef = useRef(0)
  const lastSwingRef = useRef(0)

  const initBlocks = useCallback(() => {
    const grid: (0 | 1 | 2)[][] = []
    for (let row = 0; row < GRID_ROWS; row++) {
      grid.push([])
      for (let col = 0; col < GRID_COLS; col++) {
        grid[row].push(Math.random() < 0.6 ? 1 : 2)
      }
    }
    return grid
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}-highScore`)
    if (saved) setHighScore(parseInt(saved, 10) || 0)
  }, [])

  const startGame = useCallback(() => {
    setPhase('day')
    setPhaseEndTime(Date.now() + DAY_DURATION_MS)
    setBlocks(initBlocks())
    setZombies([])
    setScore(0)
    setHearts(HEARTS)
    setGameOver(false)
    setPlaying(true)
    zombieIdRef.current = 0
    nextZombieSpawnRef.current = 0
  }, [initBlocks])

  // Day/night cycle
  useEffect(() => {
    if (!playing || gameOver) return
    const check = () => {
      const now = Date.now()
      if (now >= phaseEndTime) {
        if (phase === 'day') {
          setPhase('night')
          setPhaseEndTime(now + NIGHT_DURATION_MS)
          nextZombieSpawnRef.current = now + 600
          // Spawn initial zombies right at night start
          setZombies(() => [
            { id: ++zombieIdRef.current, x: -ZOMBIE_SIZE, y: PLAYER_Y - 20 },
            { id: ++zombieIdRef.current, x: GAME_WIDTH, y: PLAYER_Y - 20 },
            { id: ++zombieIdRef.current, x: -ZOMBIE_SIZE - 50, y: PLAYER_Y - 40 },
          ])
        } else {
          setPhase('day')
          setPhaseEndTime(now + DAY_DURATION_MS)
          setBlocks(initBlocks())
          setZombies([])
        }
      }
    }
    const id = setInterval(check, 200)
    return () => clearInterval(id)
  }, [playing, gameOver, phase, phaseEndTime, initBlocks])

  // Night: spawn and move zombies
  useEffect(() => {
    if (!playing || gameOver || phase !== 'night') return
    const centerX = GAME_WIDTH / 2
    const tick = () => {
      const now = Date.now()
      setZombies((prev) => {
        let next = prev.map((z) => {
          const dx = centerX - (z.x + ZOMBIE_SIZE / 2)
          const move = Math.sign(dx) * ZOMBIE_SPEED
          return { ...z, x: z.x + move }
        })
        if (now >= nextZombieSpawnRef.current) {
          nextZombieSpawnRef.current = now + ZOMBIE_SPAWN_INTERVAL_MS
          const fromLeft = Math.random() < 0.5
          next = [
            ...next,
            {
              id: ++zombieIdRef.current,
              x: fromLeft ? -ZOMBIE_SIZE : GAME_WIDTH,
              y: PLAYER_Y - 20,
            },
          ]
        }
        return next
      })
    }
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [playing, gameOver, phase])

  // Night: zombie touch = lose heart
  useEffect(() => {
    if (!playing || gameOver || phase !== 'night' || hearts <= 0) return
    const playerCenterX = GAME_WIDTH / 2
    const playerLeft = playerCenterX - PLAYER_SIZE / 2
    const playerRight = playerCenterX + PLAYER_SIZE / 2
    const hit = zombies.some((z) => {
      const zLeft = z.x
      const zRight = z.x + ZOMBIE_SIZE
      return (
        playerRight > zLeft &&
        playerLeft < zRight &&
        z.y >= PLAYER_Y - ZOMBIE_SIZE &&
        z.y <= PLAYER_Y + PLAYER_SIZE
      )
    })
    if (hit) {
      setHearts((h) => Math.max(0, h - 1))
      setZombies((prev) =>
        prev.filter((z) => {
          const zLeft = z.x
          const zRight = z.x + ZOMBIE_SIZE
          return !(
            playerRight > zLeft &&
            playerLeft < zRight &&
            z.y >= PLAYER_Y - ZOMBIE_SIZE &&
            z.y <= PLAYER_Y + PLAYER_SIZE
          )
        })
      )
    }
  }, [playing, gameOver, phase, zombies, hearts])

  // Game over when hearts 0
  useEffect(() => {
    if (hearts <= 0 && playing) {
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
  }, [hearts, playing, highScore])

  const mineBlock = useCallback((row: number, col: number) => {
    if (phase !== 'day' || !playing || gameOver) return
    setBlocks((prev) => {
      const copy = prev.map((r) => [...r])
      if (copy[row]?.[col]) {
        const block = copy[row][col]
        copy[row][col] = 0
        setScore((s) => s + (block === 1 ? 5 : 10))
      }
      return copy
    })
  }, [phase, playing, gameOver])

  const swingSword = useCallback(() => {
    if (phase !== 'night' || !playing || gameOver || swordSwinging) return
    const now = Date.now()
    if (now - lastSwingRef.current < SWORD_COOLDOWN_MS) return
    lastSwingRef.current = now
    setSwordSwinging(true)
    setTimeout(() => setSwordSwinging(false), 150)
    const centerX = GAME_WIDTH / 2
    setZombies((prev) => {
      const killed = prev.filter((z) => {
        const zCenter = z.x + ZOMBIE_SIZE / 2
        const dist = Math.abs(zCenter - centerX)
        return dist <= SWORD_RANGE
      })
      if (killed.length > 0) setScore((s) => s + killed.length * 15)
      return prev.filter((z) => {
        const zCenter = z.x + ZOMBIE_SIZE / 2
        return Math.abs(zCenter - centerX) > SWORD_RANGE
      })
    })
  }, [phase, playing, gameOver, swordSwinging])

  useEffect(() => {
    if (phase !== 'night' || !playing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        swingSword()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, playing, swingSword])

  return (
    <div className="mx-auto max-w-2xl">
      <style>{`
        @keyframes sun-burn {
          0%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 8px rgba(255,180,0,0.8)); }
          50% { transform: scale(1.15); filter: brightness(1.3) drop-shadow(0 0 16px rgba(255,140,0,0.9)); }
        }
        @keyframes ember-float {
          0% { transform: translate(0,0) scale(1); opacity: 0.9; }
          50% { transform: translate(4px,-6px) scale(1.2); opacity: 1; }
          100% { transform: translate(-3px,-12px) scale(0.8); opacity: 0.4; }
        }
        .sun-burn { animation: sun-burn 2s ease-in-out infinite; }
        .ember-float { animation: ember-float 2.5s ease-in-out infinite; }
      `}</style>
      <header className="mb-6 text-center">
        <span className="text-6xl" role="img" aria-hidden>
          {game.emoji}
        </span>
        <h1 className="mt-4 text-2xl font-bold">{game.name}&apos;s Game</h1>
        <p className="mt-1 text-muted-foreground">
          {game.grade} Grade · {game.teacher}
        </p>
      </header>

      <div className="rounded-xl border border-amber-900/40 bg-stone-900/50 p-6 shadow-inner">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          {phase === 'day'
            ? '☀️ Day — click blocks to mine! (Dirt = 5 pts, Stone = 10 pts)'
            : '🌙 Night — use your sword! Click or press SPACE to attack zombies.'}
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
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-amber-800/60 shadow-inner"
          style={{
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            background:
              phase === 'day'
                ? 'linear-gradient(to bottom, #87CEEB 0%, #98D98E 70%, #8B7355 100%)'
                : 'linear-gradient(to bottom, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }}
          tabIndex={0}
        >
          {phase === 'day' && (
            <>
              {/* Floating embers / burning effect */}
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="ember-float absolute text-xl opacity-90"
                  style={{
                    left: `${15 + i * 22}%`,
                    top: `${8 + (i % 3) * 12}%`,
                    animationDelay: `${i * 0.4}s`,
                  }}
                  role="img"
                  aria-hidden
                >
                  🔥
                </div>
              ))}
              <div
                className="sun-burn absolute right-3 top-3 text-4xl opacity-95"
                role="img"
                aria-hidden
              >
                ☀️
              </div>
              <div
                className="absolute left-0 top-0 grid gap-0.5 p-1"
                style={{
                  gridTemplateColumns: `repeat(${GRID_COLS}, ${BLOCK_SIZE}px)`,
                  gridTemplateRows: `repeat(${GRID_ROWS}, ${BLOCK_SIZE}px)`,
                }}
              >
                {blocks.map((row, ri) =>
                  row.map((cell, ci) => (
                    <button
                      key={`${ri}-${ci}`}
                      type="button"
                      disabled={cell === 0 || !playing}
                      onClick={() => mineBlock(ri, ci)}
                      className="flex items-center justify-center rounded border-2 border-amber-900/60 transition active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                      style={{
                        width: BLOCK_SIZE - 4,
                        height: BLOCK_SIZE - 4,
                        backgroundColor: cell === 1 ? '#8B7355' : '#6B6B6B',
                        boxShadow: cell ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none',
                      }}
                      aria-label={cell === 0 ? 'Empty' : cell === 1 ? 'Mine dirt block' : 'Mine stone block'}
                    >
                      {cell === 1 && '🟫'}
                      {cell === 2 && '🪨'}
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {phase === 'night' && (
            <>
              <div
                className="absolute left-1/2 top-4 text-3xl opacity-80"
                style={{ transform: 'translateX(-50%)' }}
                role="img"
                aria-hidden
              >
                🌙
              </div>
              <button
                type="button"
                className="absolute left-1/2 flex items-center justify-center rounded-lg border-2 border-amber-700 bg-amber-900/80 transition active:scale-95 disabled:pointer-events-none"
                style={{
                  width: PLAYER_SIZE,
                  height: PLAYER_SIZE,
                  bottom: GAME_HEIGHT - PLAYER_Y - PLAYER_SIZE / 2,
                  transform: `translateX(-50%) ${swordSwinging ? 'rotate(-30deg)' : ''}`,
                }}
                onClick={swingSword}
                aria-label="Swing sword"
              >
                ⚔️
              </button>
              {zombies.map((z) => (
                <div
                  key={z.id}
                  className="absolute flex items-center justify-center rounded border-2 border-green-900 bg-green-800 text-2xl"
                  style={{
                    left: z.x,
                    top: z.y,
                    width: ZOMBIE_SIZE,
                    height: ZOMBIE_SIZE,
                  }}
                  role="img"
                  aria-hidden
                >
                  🧟
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
