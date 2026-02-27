import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/games/kiaan')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'kiaan')!

const STORAGE_KEY = 'kiaan-swordfight'
const ARENA_WIDTH = 520
const ARENA_HEIGHT = 280
const GROUND_Y = ARENA_HEIGHT - 24
const GRAVITY = 0.6
const MOVE_SPEED = 5
const JUMP_VEL = -12
const PLAYER_WIDTH = 28
const PLAYER_HEIGHT = 56
const SWORD_LENGTH = 44
const SWORD_ACTIVE_MS = 180
const ATTACK_COOLDOWN_MS = 400
const HIT_INVULN_MS = 300 // can't be hit again for this long after taking damage
const DAMAGE_PER_HIT = 18
const MAX_HEALTH = 100

type PlayerState = {
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1 // 1 = right
  attacking: boolean
  attackEndAt: number
  lastAttackAt: number
  health: number
  lastDamageAt: number
}

function GameComponent() {
  const [p1, setP1] = useState<PlayerState>(() => ({
    x: 80,
    y: GROUND_Y - PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    facing: 1,
    attacking: false,
    attackEndAt: 0,
    lastAttackAt: 0,
    health: MAX_HEALTH,
    lastDamageAt: 0,
  }))
  const [p2, setP2] = useState<PlayerState>(() => ({
    x: ARENA_WIDTH - 80 - PLAYER_WIDTH,
    y: GROUND_Y - PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    facing: -1,
    attacking: false,
    attackEndAt: 0,
    lastAttackAt: 0,
    health: MAX_HEALTH,
    lastDamageAt: 0,
  }))
  const [playing, setPlaying] = useState(false)
  const [winner, setWinner] = useState<1 | 2 | null>(null)
  const [p1Wins, setP1Wins] = useState(0)
  const [p2Wins, setP2Wins] = useState(0)
  const keysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const p1w = localStorage.getItem(`${STORAGE_KEY}-p1Wins`)
    const p2w = localStorage.getItem(`${STORAGE_KEY}-p2Wins`)
    if (p1w) setP1Wins(parseInt(p1w, 10) || 0)
    if (p2w) setP2Wins(parseInt(p2w, 10) || 0)
  }, [])

  const resetRound = useCallback(() => {
    setP1((prev) => ({
      ...prev,
      x: 80,
      y: GROUND_Y - PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
      facing: 1,
      attacking: false,
      attackEndAt: 0,
      lastAttackAt: 0,
      health: MAX_HEALTH,
      lastDamageAt: 0,
    }))
    setP2((prev) => ({
      ...prev,
      x: ARENA_WIDTH - 80 - PLAYER_WIDTH,
      y: GROUND_Y - PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
      facing: -1,
      attacking: false,
      attackEndAt: 0,
      lastAttackAt: 0,
      health: MAX_HEALTH,
      lastDamageAt: 0,
    }))
    setWinner(null)
  }, [])

  const startGame = useCallback(() => {
    resetRound()
    setPlaying(true)
  }, [resetRound])

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
      }
      keysRef.current.add(e.key)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Physics + input + hit detection
  useEffect(() => {
    if (!playing || winner !== null) return

    const tick = () => {
      const keys = keysRef.current
      const now = Date.now()

      setP1((prev) => {
        let vx = 0
        if (keys.has('a')) vx -= MOVE_SPEED
        if (keys.has('d')) vx += MOVE_SPEED
        const facing = vx !== 0 ? (vx > 0 ? 1 : -1) : prev.facing
        let vy = prev.vy + GRAVITY
        if (keys.has('w') && prev.y >= GROUND_Y - PLAYER_HEIGHT - 2) {
          vy = JUMP_VEL
        }
        let attacking = prev.attacking
        let attackEndAt = prev.attackEndAt
        let lastAttackAt = prev.lastAttackAt
        if (keys.has(' ') && now >= prev.lastAttackAt + ATTACK_COOLDOWN_MS && !prev.attacking) {
          attacking = true
          attackEndAt = now + SWORD_ACTIVE_MS
          lastAttackAt = now
        }
        if (now >= attackEndAt) attacking = false

        let x = prev.x + vx
        x = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, x))
        let y = prev.y + vy
        if (y >= GROUND_Y - PLAYER_HEIGHT) {
          y = GROUND_Y - PLAYER_HEIGHT
          vy = 0
        }
        return {
          ...prev,
          x,
          y,
          vx,
          vy,
          facing,
          attacking,
          attackEndAt,
          lastAttackAt,
        }
      })

      setP2((prev) => {
        let vx = 0
        if (keys.has('ArrowLeft')) vx -= MOVE_SPEED
        if (keys.has('ArrowRight')) vx += MOVE_SPEED
        const facing = vx !== 0 ? (vx > 0 ? 1 : -1) : prev.facing
        let vy = prev.vy + GRAVITY
        if (keys.has('ArrowUp') && prev.y >= GROUND_Y - PLAYER_HEIGHT - 2) {
          vy = JUMP_VEL
        }
        let attacking = prev.attacking
        let attackEndAt = prev.attackEndAt
        let lastAttackAt = prev.lastAttackAt
        if (keys.has('Enter') && now >= prev.lastAttackAt + ATTACK_COOLDOWN_MS && !prev.attacking) {
          attacking = true
          attackEndAt = now + SWORD_ACTIVE_MS
          lastAttackAt = now
        }
        if (now >= attackEndAt) attacking = false

        let x = prev.x + vx
        x = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, x))
        let y = prev.y + vy
        if (y >= GROUND_Y - PLAYER_HEIGHT) {
          y = GROUND_Y - PLAYER_HEIGHT
          vy = 0
        }
        return {
          ...prev,
          x,
          y,
          vx,
          vy,
          facing,
          attacking,
          attackEndAt,
          lastAttackAt,
        }
      })
    }

    const id = setInterval(tick, 1000 / 60)
    return () => clearInterval(id)
  }, [playing, winner])

  // Hit detection: sword vs other player body (one hit per swing via invuln)
  useEffect(() => {
    if (!playing || winner !== null) return

    const id = setInterval(() => {
      const now = Date.now()
      setP1((p1State) => {
        if (!p2.attacking || now < p1State.lastDamageAt + HIT_INVULN_MS) return p1State
        const swordTip = p2.facing === 1
          ? p2.x + PLAYER_WIDTH + SWORD_LENGTH
          : p2.x - SWORD_LENGTH
        const swordLeft = Math.min(p2.x + PLAYER_WIDTH, swordTip)
        const swordRight = Math.max(p2.x + PLAYER_WIDTH, swordTip)
        const overlap =
          p1State.x + PLAYER_WIDTH > swordLeft &&
          p1State.x < swordRight &&
          p1State.y + PLAYER_HEIGHT > p2.y &&
          p1State.y < p2.y + PLAYER_HEIGHT
        if (!overlap) return p1State
        const newHealth = Math.max(0, p1State.health - DAMAGE_PER_HIT)
        if (newHealth <= 0) {
          setWinner(2)
          setP2Wins((w) => {
            const next = w + 1
            localStorage.setItem(`${STORAGE_KEY}-p2Wins`, String(next))
            return next
          })
        }
        return { ...p1State, health: newHealth, lastDamageAt: now }
      })
      setP2((p2State) => {
        if (!p1.attacking || now < p2State.lastDamageAt + HIT_INVULN_MS) return p2State
        const swordTip = p1.facing === 1
          ? p1.x + PLAYER_WIDTH + SWORD_LENGTH
          : p1.x - SWORD_LENGTH
        const swordLeft = Math.min(p1.x + PLAYER_WIDTH, swordTip)
        const swordRight = Math.max(p1.x + PLAYER_WIDTH, swordTip)
        const overlap =
          p2State.x + PLAYER_WIDTH > swordLeft &&
          p2State.x < swordRight &&
          p2State.y + PLAYER_HEIGHT > p1.y &&
          p2State.y < p1.y + PLAYER_HEIGHT
        if (!overlap) return p2State
        const newHealth = Math.max(0, p2State.health - DAMAGE_PER_HIT)
        if (newHealth <= 0) {
          setWinner(1)
          setP1Wins((w) => {
            const next = w + 1
            localStorage.setItem(`${STORAGE_KEY}-p1Wins`, String(next))
            return next
          })
        }
        return { ...p2State, health: newHealth, lastDamageAt: now }
      })
    }, 50)
    return () => clearInterval(id)
  }, [playing, winner, p1.x, p1.y, p1.attacking, p1.facing, p2.x, p2.y, p2.attacking, p2.facing])

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

      <div className="rounded-xl border border-amber-900/40 bg-stone-900/50 p-6 shadow-inner">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Stick figure sword battle — first to drop the other to 0 health wins.
        </p>
        <div className="mb-3 flex items-center justify-center gap-6">
          <span className="rounded bg-blue-900/50 px-3 py-1 font-mono text-sm">
            P1: {p1Wins} wins
          </span>
          <span className="rounded bg-rose-900/50 px-3 py-1 font-mono text-sm">
            P2: {p2Wins} wins
          </span>
          {!playing && (
            <Button onClick={startGame}>Start / New round</Button>
          )}
          {playing && winner !== null && (
            <Button
              onClick={() => {
                resetRound()
                setPlaying(true)
              }}
            >
              Next round
            </Button>
          )}
        </div>

        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>P1: WASD move · W jump · Space attack</span>
          <span>P2: Arrows move · Up jump · Enter attack</span>
        </div>

        {/* Health bars */}
        <div className="mb-2 flex gap-2">
          <div className="flex-1">
            <div className="mb-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              P1
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width]"
                style={{ width: `${(p1.health / MAX_HEALTH) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="mb-0.5 text-right text-xs font-medium text-rose-600 dark:text-rose-400">
              P2
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="ml-auto h-full rounded-full bg-rose-600 transition-[width]"
                style={{ width: `${(p2.health / MAX_HEALTH) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {winner !== null && (
          <p className="mb-2 text-center font-bold">
            {winner === 1 ? 'Player 1 wins!' : 'Player 2 wins!'}
          </p>
        )}

        <div
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-amber-800/60 bg-gradient-to-b from-sky-900/30 to-amber-900/40"
          style={{ width: ARENA_WIDTH, height: ARENA_HEIGHT }}
        >
          {/* Ground */}
          <div
            className="absolute left-0 right-0 border-t-2 border-amber-800 bg-amber-900/80"
            style={{ top: GROUND_Y, height: ARENA_HEIGHT - GROUND_Y }}
          />

          {/* Stick figure P1 */}
          <StickFigure
            x={p1.x}
            y={p1.y}
            facing={p1.facing}
            attacking={p1.attacking}
            color="stroke-blue-500"
            fill="fill-blue-500/20"
          />
          {/* Stick figure P2 */}
          <StickFigure
            x={p2.x}
            y={p2.y}
            facing={p2.facing}
            attacking={p2.attacking}
            color="stroke-rose-500"
            fill="fill-rose-500/20"
          />
        </div>
      </div>
    </div>
  )
}

function StickFigure({
  x,
  y,
  facing,
  attacking,
  color,
  fill,
}: {
  x: number
  y: number
  facing: 1 | -1
  color: string
  fill: string
  attacking: boolean
}) {
  const cx = PLAYER_WIDTH / 2
  const armY = 36
  const swordHandX = cx + 12 * facing
  const swordTipX = swordHandX + (attacking ? SWORD_LENGTH * facing : 14 * facing)

  return (
    <svg
      className="absolute left-0 top-0 overflow-visible"
      width={ARENA_WIDTH}
      height={ARENA_HEIGHT}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      aria-hidden
    >
      {/* Head */}
      <circle
        cx={cx}
        cy={14}
        r={10}
        className={`${color} ${fill}`}
        strokeWidth={2}
      />
      {/* Body */}
      <line
        x1={cx}
        x2={cx}
        y1={28}
        y2={PLAYER_HEIGHT - 10}
        className={color}
        strokeWidth={2}
        stroke="currentColor"
      />
      {/* Arm holding sword */}
      <line
        x1={cx}
        y1={armY}
        x2={swordHandX}
        y2={armY}
        className={color}
        strokeWidth={2}
        stroke="currentColor"
      />
      {/* Sword */}
      <line
        x1={swordHandX}
        y1={armY}
        x2={swordTipX}
        y2={armY - 4}
        className="stroke-amber-600"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Other arm */}
      <line
        x1={cx}
        y1={armY}
        x2={cx - 14 * facing}
        y2={armY + 4}
        className={color}
        strokeWidth={2}
        stroke="currentColor"
      />
      {/* Legs */}
      <line
        x1={cx}
        y1={PLAYER_HEIGHT - 10}
        x2={cx - 8}
        y2={PLAYER_HEIGHT}
        className={color}
        strokeWidth={2}
        stroke="currentColor"
      />
      <line
        x1={cx}
        y1={PLAYER_HEIGHT - 10}
        x2={cx + 8}
        y2={PLAYER_HEIGHT}
        className={color}
        strokeWidth={2}
        stroke="currentColor"
      />
    </svg>
  )
}
