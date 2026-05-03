import { spawn } from 'node:child_process'

const port = process.env.PORT ?? '3000'
spawn('bun', ['x', '--bun', 'stx-serve', 'pages/', '--port', port], {
  stdio: 'inherit',
  env: process.env,
})
