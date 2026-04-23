import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

// Config
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService)
  const frontendUrl = configService.get<string>('FRONTEND_URL')

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type'
    ],
    methods: 'GET,POST,PUT,DELETE,PATCH',
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // SWAGGER

  const config = new DocumentBuilder()
    .setTitle('API Pagina Rol')
    .setDescription('Documentacion para la API de rol')
    .setVersion('1.0')
    .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token'
    )
    .build()
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
