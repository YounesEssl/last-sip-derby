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
    origin: true,
    credentials: true,
  })

  const port = parseInt(process.env.PORT ?? '3001', 10)
  await app.listen(port, '0.0.0.0')

  const localIP = getLocalIP()
  console.log(`\n  Last Sip Derby - Server running on port ${port}`)
  console.log(`  Mobile accessible on http://${localIP}:3002\n`)
}

bootstrap()
