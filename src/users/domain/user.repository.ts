import { FindAllUsersParams } from '../interface/params.interface.js';
import { User } from './user.entity.js';

export interface UserRepository {
  create(user: Partial<User>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Baja lógica: marca `activo = false` sin borrar la fila. */
  deactivate(id: string): Promise<User>;
  /** Reactiva una cuenta dada de baja: marca `activo = true`. */
  activate(id: string): Promise<User>;
  findAll(
    params: FindAllUsersParams,
  ): Promise<{ items: User[]; total: number }>;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';
