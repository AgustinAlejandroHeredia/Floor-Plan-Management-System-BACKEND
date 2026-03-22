import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth0Service } from './auth0/auth0.service';

@Module({
  providers: [
    {
      provide: AuthService,
      useClass: Auth0Service,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}