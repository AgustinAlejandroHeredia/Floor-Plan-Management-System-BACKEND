import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { getAuthTestModeUser } from 'src/utils/auth-test-mode';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Solo entra aca con AUTH_TEST_MODE prendido fuera de produccion; si no,
    // getAuthTestModeUser() devuelve null y sigue la validacion normal.
    const testUser = getAuthTestModeUser();
    if (!testUser) {
      return super.canActivate(context);
    }
    context.switchToHttp().getRequest().user = testUser;
    return true;
  }
}
