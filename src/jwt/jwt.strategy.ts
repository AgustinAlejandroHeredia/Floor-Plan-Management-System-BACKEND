import { Injectable } from '@nestjs/common';

// JWT
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

// Config
import { ConfigService } from '@nestjs/config';

// Service
import { UserService } from 'src/user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(
    config: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: config.get<string>('AUTH0_ISSUER_URL'),
      audience: config.get<string>('AUTH0_AUDIENCE'),
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${config.get<string>('AUTH0_ISSUER_URL')}.well-known/jwks.json`,
      }),
    });
  }

  async validate(payload: any) {

    const user = await this.userService.getOrCreateUserFromPayload(payload);

    return {
      internalId: user._id.toString(),
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  }
}