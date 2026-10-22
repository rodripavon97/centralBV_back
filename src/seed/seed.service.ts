import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  async onApplicationBootstrap() {
    this.logger.log('Verificando datos iniciales...');
    await this.seedRoles();
    
    // Create users with different roles. If they already exist, they will be skipped.
    await this.seedUser('admin@centralbv.com', 'Admin123!', 'Super', 'Admin', 'ADMIN');
    await this.seedUser('administrativo@centralbv.com', 'Admin123!', 'Usuario', 'Administrativo', 'ADMINISTRATIVO');
    
    this.logger.log('Bootstrap finalizado.');
  }

  private async seedRoles() {
    const roles = [
      { nombre: 'COMUN', descripcion: 'Ver móviles - Marcar Operativo/Fuera de servicio' },
      { nombre: 'AUTOMOTORES', descripcion: 'Alta, baja y modificación de móviles.' },
      { nombre: 'ADMINISTRATIVO', descripcion: '  dulo de constancias.' },
      { nombre: 'ADMIN', descripcion: 'Gestión de usuarios y roles.' },
    ];

    for (const rol of roles) {
      const { data } = await this.db.from('roles').select('id').eq('nombre', rol.nombre).single();
      if (!data) {
        await this.db.from('roles').insert([rol]);
        this.logger.log(`Rol creado: ${rol.nombre}`);
      }
    }
  }

  // A Generic, Fail-Safe Method for Creating Any Initial User
  private async seedUser(email: string, pass: string, nombre: string, apellido: string, roleName: string) {
    let userId: string | null = null;

    try {
      // Check if it already exists in public.users
      const { data: existingUser } = await this.db.from('usuarios').select('id').eq('email', email).single();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // 2. Create the user in Supabase Auth
        const { data: authData, error: authError } = await this.db.auth.admin.createUser({
          email: email,
          password: pass,
          email_confirm: true,
        });

        if (authError) {
          const msg = authError.message.toLowerCase();
          if (msg.includes('already') || msg.includes('registered')) {
            const { data: listData } = await this.db.auth.admin.listUsers();
            userId = listData?.users.find((u: { email?: string | null; id: string }) => u.email === email)?.id || null;
          } else {
            throw authError;
          }
        } else {
          userId = authData.user.id;
        }

        if (!userId) throw new Error('No se pudo obtener el ID de Auth');

        // 3. Insert into public.users
        await this.db.from('usuarios').insert([{
          id: userId,
          email: email,
          nombre: nombre,
          apellido: apellido,
          activo: true,
        }]);
      }

      // 4. Assign Role (Always runs)
      const { data: roleData } = await this.db.from('roles').select('id').eq('nombre', roleName).single();
      if (roleData && userId) {
        await this.db.from('usuario_rol').upsert(
          [{ usuario_id: userId, rol_id: roleData.id }],
          { onConflict: 'usuario_id,rol_id' }
        );
      }

      this.logger.log(`✅ Usuario asegurado: ${email} con rol ${roleName}`);
    } catch (error) {
      this.logger.error(`❌ Error asegurando usuario ${email}: ` + (error instanceof Error ? error.message : String(error)));
    }
  }
}