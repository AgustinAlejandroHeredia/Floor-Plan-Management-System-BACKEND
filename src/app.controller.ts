import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@ApiTags('Test')
@Controller('test')
export class AppController {

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Testear recepción de token' })
  test(@Headers() headers: Record<string, any>) {
    const authHeader = headers.authorization;

    if (authHeader) {
      console.log('🔐 Token recibido:');
      console.log(authHeader);
    } else {
      console.log('❌ No se recibió token');
    }

    return {
      message: 'Request recibida',
      hasToken: !!authHeader,
      authorization: authHeader || null,
    };
  }
}