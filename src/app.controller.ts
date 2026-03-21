import { Controller, Get, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Test')
@Controller('test')
export class AppController {

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