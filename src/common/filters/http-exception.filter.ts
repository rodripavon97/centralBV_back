import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();
    const message =
      typeof exceptionResponse === 'object'
        ? exceptionResponse.message
        : exceptionResponse;

    // Errores por campo (ver common/utils/field-error.ts): el front los
    // muestra debajo del input correspondiente.
    const fieldDetails =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? {
            ...(typeof exceptionResponse.campo === 'string' && {
              campo: exceptionResponse.campo,
            }),
            ...(typeof exceptionResponse.code === 'string' && {
              code: exceptionResponse.code,
            }),
          }
        : {};

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message || exception.message,
      error: exception.name,
      ...fieldDetails,
    });
  }
}