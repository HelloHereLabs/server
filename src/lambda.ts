import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Server } from 'http';
import express from 'express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// WebSocket 핸들러 import
import { websocketHandler } from './websocket-handler';

let cachedServer: Server;

async function createNestServer(expressApp: express.Application) {
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('외국인-시민 매칭 서비스')
    .setDescription('외국인과 시민 간의 매칭 및 대화 지원 API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: '3일 유효기간 토큰을 입력하세요',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.init();
  return app.getHttpServer();
}

// REST API Lambda 핸들러
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  // WebSocket 요청인지 확인
  if (event.requestContext && 'routeKey' in event.requestContext) {
    return websocketHandler(event, context);
  }

  // REST API 요청 처리
  if (!cachedServer) {
    const expressApp = express();
    cachedServer = await createNestServer(expressApp);
  }

  const awsServerlessExpress = await import('aws-serverless-express');
  return awsServerlessExpress.proxy(cachedServer, event, context, 'PROMISE').promise;
};

// WebSocket 전용 핸들러 (별도 Lambda 함수로 사용할 경우)
export { websocketHandler };