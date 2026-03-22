import { Injectable } from '@nestjs/common';

// JWT imports
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

// Config
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(config: ConfigService) {

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
            })
        })
    }

    validate(payload: any){
        return {
            userId: payload.sub,
            permissions: payload.permissions ?? [],
        }
    }
}