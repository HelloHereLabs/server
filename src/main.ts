import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn']
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // 환경변수에서 CORS origins 읽기
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['https://develop.d39gx5kr6gfiso.amplifyapp.com'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle(process.env.APP_TITLE || '외국인-시민 매칭 서비스')
    .setDescription(process.env.APP_DESCRIPTION || '외국인과 시민 간의 매칭 및 대화 지원 API')
    .setVersion(process.env.APP_VERSION || '1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: `${process.env.TOKEN_EXPIRY || '3d'} 유효기간 토큰을 입력하세요`,
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger documentation: ${await app.getUrl()}/api`);
}

bootstrap();