import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

const processes = [
  spawn(process.execPath, ['server/local.mjs'], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  }),
  spawn(process.execPath, [viteBin], {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
  }),
]

let shuttingDown = false

function stopAll(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of processes) {
    if (!child.killed) {
      child.kill()
    }
  }

  process.exit(exitCode)
}

for (const child of processes) {
  child.on('exit', code => {
    if (!shuttingDown) {
      stopAll(code ?? 0)
    }
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
