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
      passReqToCallback: true,
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

  async validate(req: any, payload: any) {

    console.log("---------- FROM VALIDATE TO CHECK PAYLOAD ----------")
    console.log("PAYLOAD RAW : ", payload)
    console.log("PAYLOAD .sub : ", payload.sub)
    console.log("----------------------------------------------------")

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.split(' ')[1];

    const user = await this.userService.getOrCreateUserFromPayload(payload, token);

    return {
      internalId: user._id.toString(),
      sub: user.authProviderId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      globalRole: user.globalRole
    };
  }
}