import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();

  // Necesario para que el rate limit use la IP real detrás de un proxy/CDN.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('CentralBV API')
    .setDescription('Gestión de bomberos voluntarios')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT) || 3000;
  // 0.0.0.0 permite recibir conexiones desde fuera del contenedor (Docker).
  await app.listen(port, '0.0.0.0');
  console.log(
    `[bootstrap] env=${process.env.NODE_ENV ?? 'development'} listening=0.0.0.0:${port}`,
  );
  console.log(`🚀 Swagger: http://localhost:${port}/api/docs`);
}
void bootstrap();