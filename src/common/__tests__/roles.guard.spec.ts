import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../guards/roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const createContext = (user: { roles?: string[] } | undefined) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  it('permite el acceso cuando no hay roles requeridos', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext({ roles: [] }))).toBe(true);
  });

  it('permite el acceso cuando el usuario tiene uno de los roles requeridos', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(guard.canActivate(createContext({ roles: ['ADMIN'] }))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('rechaza el acceso cuando el usuario no tiene el rol requerido', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() =>
      guard.canActivate(createContext({ roles: ['ADMINISTRATIVO'] })),
    ).toThrow(ForbiddenException);
  });

  it('rechaza el acceso cuando el usuario no tiene roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(createContext({}))).toThrow(
      ForbiddenException,
    );
  });

  it('ADMIN pasa cualquier restricción de rol', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['AUTOMOTORES']);
    expect(guard.canActivate(createContext({ roles: ['ADMIN'] }))).toBe(true);
  });

  it('AUTOMOTORES pasa donde se lo pide y no en otros roles', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['AUTOMOTORES']);
    expect(guard.canActivate(createContext({ roles: ['AUTOMOTORES'] }))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(createContext({ roles: ['COMUN'] })),
    ).toThrow(ForbiddenException);
  });

  it('rechaza si no hay usuario en la request', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['AUTOMOTORES']);
    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
