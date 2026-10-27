import 'reflect-metadata';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtStrategy } from '../strategies/jwt.strategy.js';

@Controller('protected')
class ProtectedController {
  @UseGuards(AuthGuard('jwt'))
  @Get()
  getProtected() {
    return { ok: true };
  }
}

describe('Sesión expirada por inactividad', () => {
  const jwtSecret = 'test-secret';
  let app: INestApplication;
  let jwtService: JwtService;
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;

    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: jwtSecret })],
      controllers: [ProtectedController],
      providers: [JwtStrategy],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    jwtService = module.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    process.env.JWT_SECRET = originalSecret;
  });

  it('permite el acceso con un token vigente', async () => {
    const token = jwtService.sign(
      { sub: 'user-1', email: 'admin@centralbv.com', roles: ['ADMIN'] },
      { expiresIn: '1h' },
    );

    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rechaza el acceso con un token expirado por inactividad', async () => {
    const expiredToken = jwtService.sign(
      { sub: 'user-1', email: 'admin@centralbv.com', roles: ['ADMIN'] },
      { expiresIn: '-1s' },
    );

    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('rechaza el acceso sin token', async () => {
    await request(app.getHttpServer()).get('/protected').expect(401);
  });
});
