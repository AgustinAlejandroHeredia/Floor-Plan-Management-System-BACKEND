import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwksRsa from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  namespace: '/inference',
  cors: { origin: '*', credentials: true },
})
export class InferenceJobGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server: Server;

  private readonly jwksClient: jwksRsa.JwksClient;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly configService: ConfigService) {
    const issuerUrl = this.configService.get<string>('AUTH0_ISSUER_URL', '');
    this.issuer = issuerUrl;
    this.audience = this.configService.get<string>('AUTH0_AUDIENCE', '');
    this.jwksClient = new jwksRsa.JwksClient({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `${issuerUrl}.well-known/jwks.json`,
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const raw: string | undefined = client.handshake.auth?.token;
    const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        client.disconnect();
        return;
      }
      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();
      jwt.verify(token, publicKey, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256'],
      });
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() jobId: string,
    @ConnectedSocket() client: Socket,
  ): void {
    void client.join(`job:${jobId}`);
  }

  emitJobUpdate(
    jobId: string,
    status: string,
    result: Record<string, unknown> | null,
  ): void {
    this.server.to(`job:${jobId}`).emit('inference:update', { status, result });
  }
}
