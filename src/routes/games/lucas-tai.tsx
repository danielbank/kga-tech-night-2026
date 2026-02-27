import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/lucas-tai')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'lucas-tai')!

// Block types: 0 = air, 1 = grass, 2 = dirt, 3 = stone, 4 = wood, 5 = leaves, 6 = plank, 7 = cobblestone, 8 = water
const BLOCK_NAMES = ['air', 'grass', 'dirt', 'stone', 'wood', 'leaves', 'plank', 'cobblestone', 'water'] as const
type BlockId = (typeof BLOCK_NAMES)[number] extends infer B ? (B extends string ? number : never) : never

const BLOCK_SIZE = 28
const COLS = 36
const ROWS = 18
const WORLD_W = COLS * BLOCK_SIZE
const WORLD_H = ROWS * BLOCK_SIZE

const GRAVITY = 0.6
const JUMP = -10
const MOVE_SPEED = 4
const PLAYER_W = 22
const PLAYER_H = 26

const STORAGE_KEY = 'lucas-tai-mindcraft'

function blockStyle(id: number): string {
  const colors: Record<number, string> = {
    0: 'transparent',
    1: 'linear-gradient(180deg, #7cba3d 0%, #5a8c2a 100%)', // grass
    2: '#8B6914',
    3: '#6b6b6b',
    4: '#5c4033',
    5: '#2d5a27',
    6: '#c4a574',
    7: '#5a5a5a',
    8: 'linear-gradient(180deg, #4a9fd4 0%, #2d7ab0 100%)', // water
  }
  return colors[id] ?? '#333'
}

function createVillageWorld(): number[][] {
  const grid: number[][] = Array(ROWS)
    .fill(0)
    .map(() => Array(COLS).fill(0))

  const ground = ROWS - 2
  const stoneStart = ROWS - 1

  for (let x = 0; x < COLS; x++) {
    grid[ground][x] = 1
    grid[stoneStart][x] = 3
    if (ground - 1 >= 0) grid[ground - 1][x] = 2
  }

  // River (village sits by the river — river on the right)
  const riverStart = 24
  const riverEnd = COLS
  for (let x = riverStart; x < riverEnd; x++) {
    if (ground - 1 >= 0) grid[ground - 1][x] = 8
    grid[ground][x] = 8
  }

  // Tree 1
  const t1x = 6
  for (let y = ground - 4; y <= ground; y++) if (y >= 0) grid[y][t1x] = 4
  for (let dy = 0; dy < 2; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const ny = ground - 5 + dy,
        nx = t1x + dx
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) grid[ny][nx] = 5
    }

  // Tree 2 (on the river bank)
  const t2x = 19
  for (let y = ground - 3; y <= ground; y++) if (y >= 0) grid[y][t2x] = 4
  for (let dy = 0; dy < 2; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const ny = ground - 4 + dy,
        nx = t2x + dx
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) grid[ny][nx] = 5
    }

  // House 1 (small)
  const h1x = 12,
    h1w = 6,
    h1h = 4
  for (let dy = 0; dy < h1h; dy++)
    for (let dx = 0; dx < h1w; dx++) {
      const y = ground - h1h - 1 + dy,
        x = h1x + dx
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) grid[y][x] = 6
    }
  grid[ground - 1][h1x + 2] = 0
  grid[ground - 2][h1x + 2] = 0

  // House 2
  const h2x = 20,
    h2w = 7,
    h2h = 5
  for (let dy = 0; dy < h2h; dy++)
    for (let dx = 0; dx < h2w; dx++) {
      const y = ground - h2h - 1 + dy,
        x = h2x + dx
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) grid[y][x] = 6
    }
  grid[ground - 1][h2x + 3] = 0
  grid[ground - 2][h2x + 3] = 0

  return grid
}

function getStoredWorld(): number[][] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as number[][]
    if (Array.isArray(parsed) && parsed.length === ROWS && parsed[0]?.length === COLS) return parsed
  } catch {}
  return null
}

function saveWorld(grid: number[][]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grid))
  } catch {}
}

function GameComponent() {
  const [world, setWorld] = useState<number[][]>(() => getStoredWorld() ?? createVillageWorld())
  const [player, setPlayer] = useState({ x: WORLD_W / 2 - PLAYER_W / 2, y: 0, vx: 0, vy: 0 })
  const [hotbar, setHotbar] = useState([1, 2, 3, 4, 5, 6, 7])
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [inventory, setInventory] = useState<Record<number, number>>(() => ({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0,
  }))
  const keys = useRef({ left: false, right: false, jump: false })
  const worldRef = useRef(world)
  worldRef.current = world

  const blockAt = useCallback((bx: number, by: number): number => {
    if (by < 0 || by >= ROWS || bx < 0 || bx >= COLS) return 3
    return worldRef.current[by][bx] ?? 0
  }, [])

  const setBlock = useCallback((bx: number, by: number, id: number) => {
    if (by < 0 || by >= ROWS || bx < 0 || bx >= COLS) return
    setWorld((prev) => {
      const next = prev.map((row) => [...row])
      next[by][bx] = id
      return next
    })
  }, [])

  const pixelToBlock = (px: number, py: number) => ({
    bx: Math.floor(px / BLOCK_SIZE),
    by: Math.floor(py / BLOCK_SIZE),
  })

  const getBlockAtPixel = (px: number, py: number) => {
    const { bx, by } = pixelToBlock(px, py)
    return blockAt(bx, by)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault()
        keys.current.jump = true
      }
      if (e.key >= '1' && e.key <= '7') setSelectedSlot(Number(e.key) - 1)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = false
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = false
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') keys.current.jump = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
          const dt = Math.min((now - last) / 1000, 0.1)
      last = now

      setPlayer((p) => {
        let vx = 0
        if (keys.current.left) vx -= MOVE_SPEED
        if (keys.current.right) vx += MOVE_SPEED

        let vy = p.vy + GRAVITY * 60 * dt
        if (keys.current.jump) {
          const footY = p.y + PLAYER_H
          const footBy = Math.floor(footY / BLOCK_SIZE)
          const leftBx = Math.floor(p.x / BLOCK_SIZE)
          const rightBx = Math.floor((p.x + PLAYER_W) / BLOCK_SIZE)
          const onGround =
            footBy >= 0 &&
            footBy < ROWS &&
            (blockAt(leftBx, footBy) !== 0 || blockAt(rightBx, footBy) !== 0) &&
            footY <= (footBy + 1) * BLOCK_SIZE + 4
          if (onGround) vy = JUMP
        }
        keys.current.jump = false

        let nx = p.x + vx * 60 * dt
        let ny = p.y + vy * 60 * dt

        const margin = 2
        const pl = nx + margin
        const pr = nx + PLAYER_W - margin
        const pt = ny + margin
        const pb = ny + PLAYER_H - margin

        const bl = Math.floor(pl / BLOCK_SIZE)
        const br = Math.floor(pr / BLOCK_SIZE)
        const bt = Math.floor(pt / BLOCK_SIZE)
        const bb = Math.floor(pb / BLOCK_SIZE)

        for (let by = bt; by <= bb; by++) {
          for (let bx = bl; bx <= br; bx++) {
            if (blockAt(bx, by) !== 0) {
              const cellLeft = bx * BLOCK_SIZE
              const cellRight = cellLeft + BLOCK_SIZE
              const cellTop = by * BLOCK_SIZE
              const cellBottom = cellTop + BLOCK_SIZE
              if (vx > 0 && p.x + PLAYER_W - margin <= cellLeft && pr >= cellLeft) nx = cellLeft - PLAYER_W + margin
              if (vx < 0 && p.x + margin >= cellRight && pl <= cellRight) nx = cellRight - margin
              if (vy > 0 && p.y + PLAYER_H - margin <= cellTop && pb >= cellTop) {
                ny = cellTop - PLAYER_H + margin
                vy = 0
              }
              if (vy < 0 && p.y + margin >= cellBottom && pt <= cellBottom) {
                ny = cellBottom - margin
                vy = 0
              }
            }
          }
        }

        nx = Math.max(0, Math.min(WORLD_W - PLAYER_W, nx))
        ny = Math.max(0, Math.min(WORLD_H - PLAYER_H, ny))

        return { x: nx, y: ny, vx, vy }
      })
    }
    const id = setInterval(tick, 1000 / 60)
    return () => clearInterval(id)
  }, [blockAt])

  const handleWorldClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const { bx, by } = pixelToBlock(px, py)
    if (by < 0 || by >= ROWS || bx < 0 || bx >= COLS) return

    const id = world[by][bx]
    if (id !== 0) {
      setBlock(bx, by, 0)
      setInventory((inv) => ({ ...inv, [id]: (inv[id] ?? 0) + 1 }))
    } else {
      const placeId = hotbar[selectedSlot]
          const count = inventory[placeId] ?? 0
          if (placeId && count > 0) {
            setBlock(bx, by, placeId)
            setInventory((inv) => ({ ...inv, [placeId]: (inv[placeId] ?? 0) - 1 }))
          }
        }
  }

  const resetWorld = () => {
    setWorld(createVillageWorld())
    setPlayer({ x: WORLD_W / 2 - PLAYER_W / 2, y: 0, vx: 0, vy: 0 })
    setInventory({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 })
  }

  useEffect(() => {
    saveWorld(world)
  }, [world])

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 text-center">
        <span className="text-6xl" role="img" aria-hidden>
          {game.emoji}
        </span>
        <h1 className="mt-4 text-2xl font-bold">{game.name}&apos;s Game</h1>
        <p className="mt-1 text-muted-foreground">
          {game.grade} Grade · {game.teacher}
        </p>
      </header>

      <div className="rounded-xl border border-muted-foreground/30 bg-muted/30 p-4">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          2D Mindcraft in a village · Move: A/D or ←→ · Jump: Space/W · Click to break, place with hotbar
        </p>
        <div className="mb-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={resetWorld}>
            Reset village
          </Button>
        </div>

        <div
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-amber-900/50 shadow-inner"
          style={{ width: WORLD_W, height: WORLD_H, background: '#87CEEB' }}
          onClick={handleWorldClick}
          role="img"
          aria-label="Game world"
        >
          {world.map((row, by) =>
            row.map((id, bx) =>
              id === 0 ? null : (
                <div
                  key={`${by}-${bx}`}
                  className="absolute border border-black/20"
                  style={{
                    left: bx * BLOCK_SIZE,
                    top: by * BLOCK_SIZE,
                    width: BLOCK_SIZE,
                    height: BLOCK_SIZE,
                    background: blockStyle(id),
                  }}
                />
              )
            )
          )}
          <div
            className="absolute border-2 border-amber-600 bg-amber-100/90"
            style={{
              left: player.x,
              top: player.y,
              width: PLAYER_W,
              height: PLAYER_H,
              borderRadius: 4,
            }}
            role="img"
            aria-label="Player"
          >
            <span className="flex h-full items-center justify-center text-lg">🧑</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1">
          {hotbar.map((blockId, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedSlot(i)}
              className={`relative flex h-10 w-10 items-center justify-center rounded border-2 text-xs transition-colors ${
                selectedSlot === i ? 'border-amber-500 ring-2 ring-amber-500/50' : 'border-muted bg-muted/50 hover:bg-muted'
              }`}
              style={blockId ? { background: blockStyle(blockId) } : undefined}
              title={`${BLOCK_NAMES[blockId] ?? 'air'} (${inventory[blockId] ?? 0})`}
            >
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">
                {inventory[blockId] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Keys 1–7 select block · Break blocks by clicking · Place with selected block (need in inventory)
        </p>
      </div>
    </div>
  )
}
