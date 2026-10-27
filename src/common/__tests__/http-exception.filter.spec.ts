import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  const createHost = () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/test' }),
      }),
    };
    return { host: host as never, status, json };
  };

  it('serializa una HttpException con mensaje string', () => {
    const { host, status, json } = createHost();
    filter.catch(new HttpException('No autorizado', HttpStatus.UNAUTHORIZED), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNAUTHORIZED,
        path: '/api/test',
        message: 'No autorizado',
        error: 'HttpException',
        timestamp: expect.any(String),
      }),
    );
  });

  it('serializa una excepción con cuerpo objeto (class-validator)', () => {
    const { host, status, json } = createHost();
    filter.catch(
      new BadRequestException({
        message: ['email must be an email'],
        error: 'Bad Request',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['email must be an email'],
        error: 'BadRequestException',
      }),
    );
  });
});
