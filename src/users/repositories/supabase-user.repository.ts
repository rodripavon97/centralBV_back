import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { UserRepository } from '../domain/user.repository.js';
import { User } from '../domain/user.entity.js';

@Injectable()
export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  async create(data: Partial<User>): Promise<User> {
    const { data: newUser, error } = await this.db
      .from('usuarios')
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return new User(
      newUser.id,
      newUser.email,
      newUser.nombre,
      newUser.apellido,
      newUser.activo,
      newUser.google_sub,
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;

    return new User(
      data.id,
      data.email,
      data.nombre,
      data.apellido,
      data.activo,
      data.google_sub,
    );
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return new User(
      data.id,
      data.email,
      data.nombre,
      data.apellido,
      data.activo,
      data.google_sub,
    );
  }
}