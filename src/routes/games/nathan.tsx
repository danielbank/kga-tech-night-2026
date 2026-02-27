import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/nathan')({
  component: NathanGame,
})

const game = games.find((g) => g.slug === 'nathan')!

const STORAGE_KEY = 'nathan-pacman'
const COLS = 19
const ROWS = 17
const CELL_PX = 24
const TICK_MS = 150

// 0 = empty, 1 = wall, 2 = dot, 3 = power pellet
const MAZE: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 3, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1],
  [1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 1, 2, 1, 2, 1, 0, 0, 2, 1, 2, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 1],
  [1, 1, 2, 2, 2, 2, 1, 2, 1, 1, 1, 2, 1, 2, 2, 2, 2, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
]

type Dir = 'up' | 'down' | 'left' | 'right'

function copyMaze(m: number[][]) {
  return m.map((row) => [...row])
}

function countDots(m: number[][]) {
  let n = 0
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (m[r][c] === 2 || m[r][c] === 3) n++
  return n
}

function canWalk(m: number[][], r: number, c: number) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false
  return m[r][c] !== 1
}

function NathanGame() {
  const [maze, setMaze] = useState<number[][]>(() => copyMaze(MAZE))
  const [pac, setPac] = useState({ r: 15, c: 9 })
  const [pacDir, setPacDir] = useState<Dir>('left')
  const [ghosts, setGhosts] = useState([
    { r: 9, c: 9 },
    { r: 11, c: 9 },
    { r: 12, c: 9 },
  ])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [gameOver, setGameOver] = useState<'win' | 'lose' | null>(null)
  const [highScore, setHighScore] = useState(0)
  const [powered, setPowered] = useState(false)
  const nextDirRef = useRef<Dir | null>(null)
  const powerUntilRef = useRef(0)

  // Load high score
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(`${STORAGE_KEY}-highScore`)
    if (saved) setHighScore(parseInt(saved, 10) || 0)
  }, [])

  const totalDots = countDots(MAZE)

  const movePac = useCallback(() => {
    setPac((prev) => {
      const dir = nextDirRef.current ?? pacDir
      let nr = prev.r
      let nc = prev.c
      if (dir === 'up') nr--
      if (dir === 'down') nr++
      if (dir === 'left') nc = nc === 0 ? COLS - 1 : nc - 1
      if (dir === 'right') nc = nc === COLS - 1 ? 0 : nc + 1
      if (!canWalk(maze, nr, nc)) return prev
      setPacDir(dir)
      nextDirRef.current = null

      setMaze((m) => {
        const next = m.map((row) => [...row])
        const cell = next[nr][nc]
        if (cell === 2) {
          next[nr][nc] = 0
          setScore((s) => {
            const ns = s + 10
            if (ns > highScore) {
              setHighScore(ns)
              localStorage.setItem(`${STORAGE_KEY}-highScore`, String(ns))
            }
            return ns
          })
        }
        if (cell === 3) {
          next[nr][nc] = 0
          setScore((s) => s + 50)
          powerUntilRef.current = Date.now() + 8000
          setPowered(true)
        }
        return next
      })
      return { r: nr, c: nc }
    })
  }, [maze, pacDir, highScore])

  const moveGhosts = useCallback(() => {
    const powered = Date.now() < powerUntilRef.current
    setGhosts((prev) =>
      prev.map((g) => {
        const choices: { r: number; c: number }[] = []
        const tryAdd = (r: number, c: number) => {
          if (canWalk(maze, r, c)) choices.push({ r, c })
        }
        tryAdd(g.r - 1, g.c)
        tryAdd(g.r + 1, g.c)
        tryAdd(g.r, g.c - 1)
        tryAdd(g.r, g.c + 1)
        if (g.c === 0) tryAdd(g.r, COLS - 1)
        if (g.c === COLS - 1) tryAdd(g.r, 0)
        if (choices.length === 0) return g
        let best = choices[0]!
        if (powered) {
          best = choices[Math.floor(Math.random() * choices.length)]!
        } else {
          let minDist = Infinity
          for (const c of choices) {
            const dist = Math.abs(c.r - pac.r) + Math.abs(c.c - pac.c)
            if (dist < minDist) {
              minDist = dist
              best = c
            }
          }
        }
        return best
      })
    )
  }, [maze, pac])

  // Game tick
  useEffect(() => {
    if (gameOver) return
    const id = setInterval(() => {
      movePac()
      moveGhosts()
    }, TICK_MS)
    return () => clearInterval(id)
  }, [gameOver, movePac, moveGhosts])

  // Collision with ghost
  useEffect(() => {
    if (gameOver) return
    const powered = Date.now() < powerUntilRef.current
    const hit = ghosts.some((g) => g.r === pac.r && g.c === pac.c)
    if (hit && powered) {
      setGhosts((g) => g.filter((gh) => !(gh.r === pac.r && gh.c === pac.c)))
      setScore((s) => s + 200)
    } else if (hit) {
      setLives((l) => {
        if (l <= 1) {
          setGameOver('lose')
          return 0
        }
        setPac({ r: 15, c: 9 })
        setGhosts([{ r: 9, c: 9 }, { r: 11, c: 9 }, { r: 12, c: 9 }])
        return l - 1
      })
    }
  }, [pac, ghosts, gameOver])

  // Win check
  useEffect(() => {
    if (gameOver) return
    const dotsLeft = countDots(maze)
    if (dotsLeft === 0) setGameOver('win')
  }, [maze, gameOver])

  const onKeyDown = (e: KeyboardEvent) => {
    if (gameOver) return
    const key = e.key
    if (key === 'ArrowUp') {
      e.preventDefault()
      nextDirRef.current = 'up'
    }
    if (key === 'ArrowDown') {
      e.preventDefault()
      nextDirRef.current = 'down'
    }
    if (key === 'ArrowLeft') {
      e.preventDefault()
      nextDirRef.current = 'left'
    }
    if (key === 'ArrowRight') {
      e.preventDefault()
      nextDirRef.current = 'right'
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gameOver])

  // Clear powered state when timer expires; respawn ghosts
  useEffect(() => {
    if (!powered) return
    const id = setInterval(() => {
      if (Date.now() >= powerUntilRef.current) {
        setPowered(false)
        setGhosts([{ r: 9, c: 9 }, { r: 11, c: 9 }, { r: 12, c: 9 }])
      }
    }, 200)
    return () => clearInterval(id)
  }, [powered])

  const reset = () => {
    setMaze(copyMaze(MAZE))
    setPac({ r: 15, c: 9 })
    setPacDir('left')
    setGhosts([{ r: 9, c: 9 }, { r: 11, c: 9 }, { r: 12, c: 9 }])
    setScore(0)
    setLives(3)
    setGameOver(null)
    setPowered(false)
    nextDirRef.current = null
    powerUntilRef.current = 0
  }


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
          Pac-Man — eat all the dots, avoid the ghosts! Use arrow keys.
        </p>
      </header>

      <div className="rounded-xl border border-muted-foreground/30 bg-muted/30 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="rounded-lg bg-background px-4 py-2 font-mono text-lg font-bold">
              Score: {score}
            </div>
            <div className="rounded-lg bg-background px-4 py-2 font-mono text-lg">
              High: {highScore}
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-background px-4 py-2">
              {Array.from({ length: lives }).map((_, i) => (
                <span key={i} role="img" aria-label="Life">
                  🟡
                </span>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              New Game
            </Button>
          </div>
        </div>

        {gameOver && (
          <div
            className={`mb-4 rounded-lg p-4 text-center font-medium ${gameOver === 'win' ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-destructive/20 text-destructive'}`}
          >
            {gameOver === 'win' ? '🎉 You ate all the dots!' : 'Game Over — the ghosts got you!'}
          </div>
        )}

        <div
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-amber-900/50 bg-slate-900 shadow-inner"
          style={{ width: COLS * CELL_PX, height: ROWS * CELL_PX }}
          tabIndex={0}
        >
          {maze.map((row, r) =>
            row.map((cell, c) => {
              const isPac = pac.r === r && pac.c === c
              const ghostHere = ghosts.find((g) => g.r === r && g.c === c)
              return (
                <div
                  key={`${r}-${c}`}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: c * CELL_PX,
                    top: r * CELL_PX,
                    width: CELL_PX,
                    height: CELL_PX,
                  }}
                >
                  {cell === 1 && (
                    <div
                      className="h-full w-full rounded-sm"
                      style={{
                        background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                        border: '1px solid #334155',
                      }}
                    />
                  )}
                  {cell === 2 && (
                    <div
                      className="rounded-full bg-amber-300"
                      style={{ width: 6, height: 6 }}
                      aria-hidden
                    />
                  )}
                  {cell === 3 && (
                    <div
                      className="rounded-full bg-amber-400"
                      style={{ width: 14, height: 14 }}
                      aria-hidden
                    />
                  )}
                  {isPac && (
                    <span
                      className="text-lg leading-none"
                      style={{
                        transform: `rotate(${pacDir === 'left' ? 0 : pacDir === 'right' ? 180 : pacDir === 'up' ? -90 : 90}deg)`,
                      }}
                      role="img"
                      aria-label="Pac-Man"
                    >
                      🟡
                    </span>
                  )}
                  {ghostHere && (
                    <span
                      className="text-lg leading-none"
                      role="img"
                      aria-label="Ghost"
                    >
                      {powered ? '👻' : '🔴'}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Arrow keys to move · Eat power pellets (big dots) to turn the tables on ghosts!
        </p>
      </div>
    </div>
  )
}
