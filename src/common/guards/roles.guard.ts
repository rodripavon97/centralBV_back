import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** ADMIN administra la app y pasa cualquier restricción de rol. */
export const SUPER_ROLE = 'ADMIN';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    const roles: string[] = user?.roles ?? [];
    const hasRole =
      roles.includes(SUPER_ROLE) ||
      requiredRoles.some((role) => roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('No tienes permisos suficientes para esta acción');
    }
    return true;
  }
}