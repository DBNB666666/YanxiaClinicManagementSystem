const fs = require('node:fs')
const path = require('node:path')
const initSqlJs = require('sql.js')
const writeFileAtomic = require('write-file-atomic')

async function runCheck() {
  const dir = path.join(process.cwd(), '.tmp', 'sqljs-check')
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'check.db')

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
  })

  const db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')
  db.run('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)')
  db.run('INSERT INTO t (name) VALUES (?)', ['ok'])
  const bytes = db.export()
  writeFileAtomic.sync(dbPath, Buffer.from(bytes))

  const reopened = new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))
  const stmt = reopened.prepare('SELECT name FROM t')
  stmt.step()
  const row = stmt.getAsObject()
  stmt.free()
  reopened.close()
  db.close()

  if (row.name !== 'ok') {
    throw new Error(`unexpected row: ${JSON.stringify(row)}`)
  }
  console.log('sql.js ok')
}

if (process.versions.electron) {
  const { app } = require('electron')
  app.commandLine.appendSwitch('no-sandbox')
  app
    .whenReady()
    .then(runCheck)
    .then(() => app.quit())
    .catch((error) => {
      console.error(error)
      app.exit(1)
    })
} else {
  runCheck()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
