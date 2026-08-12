export const MAZE_BANK_SIZE = 50
export const MAZE_SIZE = 23

export type MazeExitSide = 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT'

export interface MazePoint {
  x: number
  y: number
}

export interface MazeLayout {
  id: number
  size: number
  cells: string[]
  start: MazePoint
  exit: MazePoint & { side: MazeExitSide }
  shortestPathLength: number
}

interface CandidateLayout extends MazeLayout {
  distanceFromTarget: number
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }
  return items
}

function createCandidate(id: number, seed: number): CandidateLayout {
  const size = MAZE_SIZE
  const start = { x: Math.floor(size / 2), y: Math.floor(size / 2) }
  const grid = Array.from({ length: size }, () => Array(size).fill('#'))
  const random = mulberry32(seed)
  const stack: MazePoint[] = [start]
  grid[start.y][start.x] = '.'

  while (stack.length) {
    const current = stack[stack.length - 1]
    const choices = shuffle([
      { x: current.x + 2, y: current.y },
      { x: current.x - 2, y: current.y },
      { x: current.x, y: current.y + 2 },
      { x: current.x, y: current.y - 2 },
    ], random).filter(({ x, y }) => x > 0 && y > 0 && x < size - 1 && y < size - 1 && grid[y][x] === '#')

    const next = choices[0]
    if (!next) {
      stack.pop()
      continue
    }

    grid[(current.y + next.y) / 2][(current.x + next.x) / 2] = '.'
    grid[next.y][next.x] = '.'
    stack.push(next)
  }

  const distances = Array.from({ length: size }, () => Array(size).fill(-1))
  const queue: MazePoint[] = [start]
  distances[start.y][start.x] = 0
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const point = queue[cursor]
    for (const next of [
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    ]) {
      if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size) continue
      if (grid[next.y][next.x] !== '.' || distances[next.y][next.x] >= 0) continue
      distances[next.y][next.x] = distances[point.y][point.x] + 1
      queue.push(next)
    }
  }

  const exits: Array<MazePoint & { side: MazeExitSide; inside: MazePoint }> = []
  for (let coordinate = 1; coordinate < size - 1; coordinate += 2) {
    exits.push({ x: coordinate, y: 0, side: 'TOP', inside: { x: coordinate, y: 1 } })
    exits.push({ x: size - 1, y: coordinate, side: 'RIGHT', inside: { x: size - 2, y: coordinate } })
    exits.push({ x: coordinate, y: size - 1, side: 'BOTTOM', inside: { x: coordinate, y: size - 2 } })
    exits.push({ x: 0, y: coordinate, side: 'LEFT', inside: { x: 1, y: coordinate } })
  }
  exits.sort((a, b) => distances[b.inside.y][b.inside.x] - distances[a.inside.y][a.inside.x])
  const chosen = exits[0]
  grid[chosen.y][chosen.x] = '.'
  const shortestPathLength = distances[chosen.inside.y][chosen.inside.x] + 1

  return {
    id,
    size,
    cells: grid.map((row) => row.join('')),
    start,
    exit: { x: chosen.x, y: chosen.y, side: chosen.side },
    shortestPathLength,
    distanceFromTarget: Math.abs(shortestPathLength - 105),
  }
}

const cache = new Map<number, MazeLayout>()

/**
 * Return one of fifty deterministic, fair layouts. Every participant receives
 * only the index, so the maze geometry and orientation are identical on every
 * phone. Candidates are selected around a 105-cell solution to avoid both
 * six-second sprints and routes that are unrealistic within the 60-second cap.
 */
export function getMazeLayout(index: number): MazeLayout {
  const id = ((Math.floor(index) % MAZE_BANK_SIZE) + MAZE_BANK_SIZE) % MAZE_BANK_SIZE
  const cached = cache.get(id)
  if (cached) return cached

  let best: CandidateLayout | null = null
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidate = createCandidate(id, (0x9e3779b9 ^ (id * 0x85ebca6b) ^ (attempt * 0xc2b2ae35)) >>> 0)
    if (!best || candidate.distanceFromTarget < best.distanceFromTarget) best = candidate
    if (candidate.shortestPathLength >= 82 && candidate.shortestPathLength <= 128) {
      best = candidate
      break
    }
  }

  if (!best) throw new Error(`Impossible de générer le labyrinthe ${id}`)
  const { distanceFromTarget: _ignored, ...layout } = best
  cache.set(id, layout)
  return layout
}
