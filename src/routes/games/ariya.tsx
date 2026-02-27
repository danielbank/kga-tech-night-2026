import { createFileRoute } from '@tanstack/react-router'
import { games } from '@/games'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'

export const Route = createFileRoute('/games/ariya')({
  component: GameComponent,
})

const game = games.find((g) => g.slug === 'ariya')!

const STORAGE_KEY = 'ariya-minecraft-creative'

const BLOCK_TYPES = [
  { id: 'grass', name: 'Grass', color: '#16a34a' },
  { id: 'dirt', name: 'Dirt', color: '#92400e' },
  { id: 'stone', name: 'Stone', color: '#78716c' },
  { id: 'wood', name: 'Wood', color: '#a16207' },
  { id: 'leaves', name: 'Leaves', color: '#166534' },
  { id: 'sand', name: 'Sand', color: '#eab308' },
  { id: 'water', name: 'Water', color: '#3b82f6' },
  { id: 'brick', name: 'Brick', color: '#b91c1c' },
] as const

type BlockId = (typeof BLOCK_TYPES)[number]['id']

function getWorldKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`
}

function loadWorld(): Record<string, BlockId> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as { world: Record<string, BlockId> }
    return data.world ?? {}
  } catch {
    return {}
  }
}

function loadPlayer(): [number, number, number] {
  if (typeof window === 'undefined') return [0, 4, 0]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [0, 4, 0]
    const data = JSON.parse(raw) as { px?: number; py?: number; pz?: number }
    return [
      data.px ?? 0,
      data.py ?? 4,
      data.pz ?? 0,
    ]
  } catch {
    return [0, 4, 0]
  }
}

function saveGame(
  world: Record<string, BlockId>,
  px: number,
  py: number,
  pz: number
) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ world, px, py, pz }))
  } catch {
    /* ignore */
  }
}

const MOVE_SPEED = 0.15
const FLY_UP = 0.12

function PlayerController({
  initialPos,
  onPositionChange,
}: {
  initialPos: [number, number, number]
  onPositionChange: (x: number, y: number, z: number) => void
}) {
  const { camera } = useThree()
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false, shift: false })
  const saveInterval = useRef(0)

  useEffect(() => {
    camera.position.set(initialPos[0], initialPos[1], initialPos[2])
  }, [camera, initialPos])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.code
      if (k === 'KeyW') keys.current.w = true
      if (k === 'KeyS') keys.current.s = true
      if (k === 'KeyA') keys.current.a = true
      if (k === 'KeyD') keys.current.d = true
      if (k === 'Space') keys.current.space = true
      if (k === 'ShiftLeft' || k === 'ShiftRight') keys.current.shift = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.code
      if (k === 'KeyW') keys.current.w = false
      if (k === 'KeyS') keys.current.s = false
      if (k === 'KeyA') keys.current.a = false
      if (k === 'KeyD') keys.current.d = false
      if (k === 'Space') keys.current.space = false
      if (k === 'ShiftLeft' || k === 'ShiftRight') keys.current.shift = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useFrame(() => {
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0))

    if (keys.current.w) {
      camera.position.addScaledVector(dir, MOVE_SPEED)
    }
    if (keys.current.s) {
      camera.position.addScaledVector(dir, -MOVE_SPEED)
    }
    if (keys.current.a) {
      camera.position.addScaledVector(right, -MOVE_SPEED)
    }
    if (keys.current.d) {
      camera.position.addScaledVector(right, MOVE_SPEED)
    }
    if (keys.current.space) {
      camera.position.y += FLY_UP
    }
    if (keys.current.shift) {
      camera.position.y -= FLY_UP
    }

    saveInterval.current++
    if (saveInterval.current >= 30) {
      saveInterval.current = 0
      onPositionChange(camera.position.x, camera.position.y, camera.position.z)
    }
  })

  return <PointerLockControls />
}

function Blocks({
  world,
  onBreak,
  onPlace,
  selectedId,
}: {
  world: Record<string, BlockId>
  onBreak: (x: number, y: number, z: number) => void
  onPlace: (x: number, y: number, z: number) => void
  selectedId: BlockId
}) {
  const handlePointerDown = useCallback(
    (e: THREE.Event) => {
      e.stopPropagation()
      const ev = e as unknown as { button: number; point: THREE.Vector3; face: THREE.Face | null; object: THREE.Object3D }
      const ud = ev.object.userData as { x: number; y: number; z: number }
      if (!ud) return
      const { x, y, z } = ud
      if (ev.button === 0) {
        onBreak(x, y, z)
      }
      if (ev.button === 2 && ev.face) {
        const n = ev.face.normal
        const nx = Math.round(x + n.x)
        const ny = Math.round(y + n.y)
        const nz = Math.round(z + n.z)
        onPlace(nx, ny, nz)
      }
    },
    [onBreak, onPlace]
  )

  return (
    <group onPointerDown={handlePointerDown}>
      {Object.entries(world).map(([key, id]) => {
        const [x, y, z] = key.split(',').map(Number)
        const block = BLOCK_TYPES.find((b) => b.id === id)!
        return (
          <mesh
            key={key}
            position={[x + 0.5, y + 0.5, z + 0.5]}
            userData={{ x, y, z }}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={block.color} />
          </mesh>
        )
      })}
    </group>
  )
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[128, 128]} />
      <meshStandardMaterial color="#14532d" />
    </mesh>
  )
}

function Scene({
  world,
  setBlock,
  selectedSlot,
  playerPos,
  onPositionChange,
}: {
  world: Record<string, BlockId>
  setBlock: (x: number, y: number, z: number, id: BlockId | null) => void
  selectedSlot: number
  playerPos: [number, number, number]
  onPositionChange: (x: number, y: number, z: number) => void
}) {
  const onBreak = useCallback(
    (x: number, y: number, z: number) => setBlock(x, y, z, null),
    [setBlock]
  )
  const onPlace = useCallback(
    (x: number, y: number, z: number) =>
      setBlock(x, y, z, BLOCK_TYPES[selectedSlot].id),
    [setBlock, selectedSlot]
  )

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={80}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Ground />
      <Blocks
        world={world}
        onBreak={onBreak}
        onPlace={onPlace}
        selectedId={BLOCK_TYPES[selectedSlot].id}
      />
      <PlayerController initialPos={playerPos} onPositionChange={onPositionChange} />
    </>
  )
}

function GameComponent() {
  const [world, setWorld] = useState<Record<string, BlockId>>(loadWorld)
  const [playerPos, setPlayerPos] = useState<[number, number, number]>(loadPlayer)
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [locked, setLocked] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const setBlock = useCallback((x: number, y: number, z: number, id: BlockId | null) => {
    setWorld((prev) => {
      const next = { ...prev }
      const key = getWorldKey(x, y, z)
      if (id === null) {
        delete next[key]
      } else {
        next[key] = id
      }
      return next
    })
  }, [])

  const handlePositionChange = useCallback((x: number, y: number, z: number) => {
    setPlayerPos([x, y, z])
  }, [])

  useEffect(() => {
    saveGame(world, playerPos[0], playerPos[1], playerPos[2])
  }, [world, playerPos])

  const clearWorld = useCallback(() => {
    setWorld({})
    setPlayerPos([0, 4, 0])
  }, [])

  const handleClickToPlay = useCallback(() => {
    const canvas = containerRef.current?.querySelector('canvas')
    ;(canvas as HTMLCanvasElement | null)?.requestPointerLock?.()
  }, [])

  useEffect(() => {
    const onChange = () => {
      setLocked(document.pointerLockElement !== null)
    }
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-4 text-center">
        <span className="text-6xl" role="img" aria-hidden>
          {game.emoji}
        </span>
        <h1 className="mt-4 text-2xl font-bold">{game.name}&apos;s Game</h1>
        <p className="mt-1 text-muted-foreground">
          {game.grade} Grade · {game.teacher}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          3D Creative mode — WASD move, Space/Shift fly, click break, right-click place
        </p>
      </header>

      <div className="rounded-xl border border-muted-foreground/30 bg-muted/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Click canvas to lock pointer · WASD move · Space/Shift up/down · Left-click break · Right-click place
          </p>
          <button
            type="button"
            onClick={clearWorld}
            className="rounded border border-muted-foreground/40 bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Clear world
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-stone-600 bg-stone-900"
        >
          <Canvas
            gl={{ antialias: true }}
            shadows
            camera={{ fov: 75, near: 0.1, far: 200 }}
          >
            <Scene
              world={world}
              setBlock={setBlock}
              selectedSlot={selectedSlot}
              playerPos={playerPos}
              onPositionChange={handlePositionChange}
            />
          </Canvas>
          {!locked && (
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-medium text-white backdrop-blur-sm transition-opacity hover:bg-black/50"
              onClick={handleClickToPlay}
            >
              Click to play (lock pointer)
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {BLOCK_TYPES.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedSlot(i)}
              className={`h-10 w-10 rounded-lg border-2 transition-all ${
                selectedSlot === i
                  ? 'border-primary ring-2 ring-primary/50'
                  : 'border-muted-foreground/30 hover:border-muted-foreground/60'
              }`}
              style={{ backgroundColor: b.color }}
              title={b.name}
            >
              <span className="sr-only">{b.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Selected: {BLOCK_TYPES[selectedSlot].name} (infinite in creative)
        </p>
      </div>
    </div>
  )
}
