import { readConfig } from './config.js'
import { createServer } from './server.js'

const config = readConfig()
const app = createServer(config)

await app.listen({ host: config.host, port: config.port })
app.log.info(`Backend listening on http://${config.host}:${config.port}`)
