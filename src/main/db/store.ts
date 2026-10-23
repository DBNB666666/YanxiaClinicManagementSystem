import fs from 'node:fs'
import path from 'node:path'
import initSqlJs from 'sql.js'
import writeFileAtomic from 'write-file-atomic'
import { migrate } from './migrate'

type SqlDatabase = initSqlJs.Database
type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>
type SqlValue = string | number | Uint8Array | null

export interface OpenStoreOptions {
  dbPath: string
  wasmDir?: string
  persist?: boolean
}

export class SqliteStore {
  private db: SqlDatabase
  private readonly dbPath: string
  private readonly persistEnabled: boolean
  private readonly SQL: SqlJsStatic
  private closed = false

  lastPersistedAt: string | null = null

  private constructor(db: SqlDatabase, dbPath: string, persistEnabled: boolean, SQL: SqlJsStatic) {
    this.db = db
    this.dbPath = dbPath
    this.persistEnabled = persistEnabled
    this.SQL = SQL
  }

  static async open(options: OpenStoreOptions): Promise<SqliteStore> {
    const SQL = await initSqlJs({
      locateFile: (file) =>
        path.join(
          options.wasmDir ?? path.join(process.cwd(), 'node_modules', 'sql.js', 'dist'),
          file
        )
    })

    const persistEnabled = options.persist !== false
    let db: SqlDatabase
    if (fs.existsSync(options.dbPath)) {
      const bytes = new Uint8Array(fs.readFileSync(options.dbPath))
      db = new SQL.Database(bytes)
    } else {
      db = new SQL.Database()
    }
    db.run('PRAGMA foreign_keys = ON')
    migrate(db)

    const store = new SqliteStore(db, options.dbPath, persistEnabled, SQL)
    if (persistEnabled) {
      fs.mkdirSync(path.dirname(options.dbPath), { recursive: true })
      store.persist()
    }
    return store
  }

  queryAll<T>(sql: string, params: SqlValue[] = []): T[] {
    const statement = this.db.prepare(sql)
    try {
      statement.bind(params)
      const rows: T[] = []
      while (statement.step()) {
        rows.push(statement.getAsObject() as T)
      }
      return rows
    } finally {
      statement.free()
    }
  }

  queryOne<T>(sql: string, params: SqlValue[] = []): T | null {
    const rows = this.queryAll<T>(sql, params)
    return rows.length ? rows[0] : null
  }

  run(sql: string, params: SqlValue[] = []): number {
    this.db.run(sql, params)
    return this.db.getRowsModified()
  }

  insert(sql: string, params: SqlValue[] = []): number {
    this.db.run(sql, params)
    const row = this.queryOne<{ id: number }>('SELECT last_insert_rowid() AS id')
    return Number(row?.id ?? 0)
  }

  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN IMMEDIATE')
    let committed = false
    try {
      const result = fn()
      this.db.run('COMMIT')
      committed = true
      this.persist()
      return result
    } catch (error) {
      if (!committed) {
        try {
          this.db.run('ROLLBACK')
        } catch {
          // ignore rollback failure
        }
      } else {
        this.reloadFromDisk()
      }
      throw error
    }
  }

  persist(): void {
    if (!this.persistEnabled) return
    const bytes = this.db.export()
    writeFileAtomic.sync(this.dbPath, Buffer.from(bytes))
    this.lastPersistedAt = new Date().toISOString()
  }

  exportBytes(): Uint8Array {
    return this.db.export()
  }

  reloadFromDisk(): void {
    if (!fs.existsSync(this.dbPath)) return
    const bytes = new Uint8Array(fs.readFileSync(this.dbPath))
    this.db.close()
    this.db = new this.SQL.Database(bytes)
    this.db.run('PRAGMA foreign_keys = ON')
  }

  close(): void {
    if (this.closed) return
    this.persist()
    this.db.close()
    this.closed = true
  }
}
