import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import * as express from 'express';
import { AppModule } from './app.module';
import { validateEnvironment } from './config/environment';

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule);
  const uploadsPath = join(process.cwd(), 'uploads');
  mkdirSync(uploadsPath, { recursive: true });
  app.use('/uploads', express.static(uploadsPath));
  const production = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.WEB_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: production ? allowedOrigins : true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(Number(process.env.PORT ?? process.env.API_PORT ?? 4000), '0.0.0.0');
}

void bootstrap();
