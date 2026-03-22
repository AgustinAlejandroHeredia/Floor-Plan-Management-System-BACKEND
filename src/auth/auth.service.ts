export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

export abstract class AuthService {
  abstract getUserInfo(token: string): Promise<AuthUser>;
}