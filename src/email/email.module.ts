import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAIL_HOST'),
          port: configService.get<number>('MAIL_PORT'),
          secure: configService.get<string>('MAIL_SECURE') === 'true',

          auth: {
            user: configService.get<string>('MAIL_USER'),
            pass: configService.get<string>('MAIL_APP_PASSWORD'),
          },
        },

        defaults: {
          from: configService.get<string>('MAIL_FROM'),
        },
      }),
    }),
  ],

  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}