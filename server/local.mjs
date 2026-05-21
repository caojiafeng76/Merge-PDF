import { createApp } from './app.mjs'

const port = Number.parseInt(process.env.PORT ?? '3001', 10)
const app = createApp()

app.listen(port, () => {
  console.log(`Merge PDF API listening on http://localhost:${port}`)
})
