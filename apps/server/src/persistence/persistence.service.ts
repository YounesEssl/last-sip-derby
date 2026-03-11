import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'

interface DumpData {
  players: Array<{
    pseudo: string
    totalSipsGiven: number
    totalSipsDrunk: number
    debt: number
  }>
  raceNumber: number
  dumpedAt: number
}

@Injectable()
export class PersistenceService {
  private dumpPath: string

  constructor() {
    this.dumpPath = process.env.STATE_DUMP_PATH ?? './state-dump.json'
  }

  async tryRestore(): Promise<DumpData | null> {
    try {
      const fullPath = path.resolve(this.dumpPath)
      if (!fs.existsSync(fullPath)) return null

      const raw = fs.readFileSync(fullPath, 'utf-8')
      const data: DumpData = JSON.parse(raw)
      console.log(`State restored from dump (${new Date(data.dumpedAt).toISOString()})`)
      return data
    } catch (err) {
      console.error('Failed to restore state:', err)
      return null
    }
  }

  dump(data: DumpData): void {
    try {
      const fullPath = path.resolve(this.dumpPath)
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2))
      console.log(`State dumped (${data.players.length} players, race #${data.raceNumber})`)
    } catch (err) {
      console.error('Failed to dump state:', err)
    }
  }
}
