import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { AuthService, AuthUser } from '../auth.service';

// Config
import { ConfigService } from "@nestjs/config";

@Injectable()
export class Auth0Service implements AuthService {

  constructor(private readonly config: ConfigService) {}

  async getUserInfo(token: string): Promise<AuthUser> {
    const issuer = this.config.get<string>('AUTH0_USERINFO_ISSUER_URL');

    const response = await axios.get(`${issuer}/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      id: response.data.sub,
      email: response.data.email,
      name: response.data.name,
      picture: response.data.picture,
    };
  }
}