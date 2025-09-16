import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import * as express from 'express';

let cachedHandler: any;

async function createApp(): Promise<express.Application> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 환경변수에서 CORS origins 읽기
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // API Gateway에서 /test/api 접두사 추가를 위해 global prefix 설정
  app.setGlobalPrefix('api');

  await app.init();
  return expressApp;
}

async function bootstrap() {
  if (!cachedHandler) {
    const expressApp = await createApp();
    cachedHandler = serverlessExpress({ app: expressApp });
  }
  return cachedHandler;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const serverlessHandler = await bootstrap();
  return serverlessHandler(event, context);
};