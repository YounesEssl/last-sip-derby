import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { networkInterfaces } from 'os'

function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [
      process.env.TV_URL ?? 'http://localhost:3000',
      process.env.MOBILE_URL ?? 'http://localhost:3002',
    ],
    credentials: true,
  })

  const port = parseInt(process.env.PORT ?? '3001', 10)
  await app.listen(port)

  const localIP = getLocalIP()
  console.log(`\n  Last Sip Derby - Server running on port ${port}`)
  console.log(`  Mobile accessible on http://${localIP}:3002\n`)
}

bootstrap()
