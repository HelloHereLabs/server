import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBService } from './modules/database/dynamodb.service';
import { UserService } from './modules/user/user.service';
import { AuthService } from './modules/auth/auth.service';
import { UpdateUserLocation, UpdateUserLocationSuccess } from './types/websocket.types';

let cachedHandler: any;

async function createApp(): Promise<express.Application> {
  const expressApp = express();

  // Cookie parser middleware 추가
  expressApp.use(cookieParser());

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
  // WebSocket 이벤트 확인
  if (event.requestContext?.routeKey) {
    return await handleWebSocketEvent(event);
  }

  // REST API 이벤트 처리
  const serverlessHandler = await bootstrap();
  return serverlessHandler(event, context);
};

// WebSocket 이벤트 처리
async function handleWebSocketEvent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(event);
      case '$disconnect':
        return await handleDisconnect(connectionId!);
      case '$default':
        return await handleWebSocketMessage(event);
      default:
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('WebSocket error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
}

async function handleConnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { connectionId } = event.requestContext;
  const token = event.queryStringParameters?.token;

  if (!token) {
    return { statusCode: 401, body: 'Token required' };
  }

  try {
    const dynamoDBService = new DynamoDBService();
    const userService = new UserService(dynamoDBService);
    const authService = new AuthService(userService);
    const decoded = authService.verifyToken(token);

    // 연결 정보를 DynamoDB에 저장
    await dynamoDBService.saveConnection(connectionId!, decoded.userId);

    console.log(`User ${decoded.userId} connected with connection ${connectionId}`);
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Authentication failed:', error);
    return { statusCode: 401, body: 'Invalid token' };
  }
}

async function handleDisconnect(connectionId: string): Promise<APIGatewayProxyResult> {
  try {
    const dynamoDBService = new DynamoDBService();
    // 연결 정보를 DynamoDB에서 제거
    await dynamoDBService.removeConnection(connectionId);
    console.log(`Connection ${connectionId} disconnected and removed from database`);
  } catch (error) {
    console.error(`Failed to remove connection ${connectionId} from database:`, error);
  }
  return { statusCode: 200, body: 'Disconnected' };
}

async function handleWebSocketMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  if (body.action === 'updateUserLocationSuccess') {
    return await handleLocationUpdate(body as UpdateUserLocationSuccess);
  }

  return { statusCode: 400, body: 'Unknown action' };
}

async function handleLocationUpdate(message: UpdateUserLocationSuccess): Promise<APIGatewayProxyResult> {
  const { userId, latitude, longitude, updatedAt } = message.data;

  if (latitude !== undefined && longitude !== undefined) {
    const dynamoDBService = new DynamoDBService();
    const userService = new UserService(dynamoDBService);
    await userService.updateUser(userId, {
      location: { latitude, longitude },
      lastLocationUpdate: updatedAt || new Date().toISOString()
    });
  }

  console.log(`Location updated for user ${userId}: ${latitude}, ${longitude}`);
  return { statusCode: 200, body: 'Location updated' };
}

