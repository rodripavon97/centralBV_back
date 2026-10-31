import { FindAllUsersParams } from '../interface/params.interface.js';
import { User } from './user.entity.js';

export interface UserRepository {
  create(user: Partial<User>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findAll(
    params: FindAllUsersParams,
  ): Promise<{ items: User[]; total: number }>;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';
