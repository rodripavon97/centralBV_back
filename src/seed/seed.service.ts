import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AccidentType,
  CertificateDestination,
  PaymentMethod,
  PaymentStatus,
  RequestStatus,
} from '../certificates/domain/certificate-request.enums.js';

type SeedVictim = {
  dni: string;
  nombre: string;
  telefono: string | null;
};

type SeedRequest = {
  damnificado: SeedVictim;
  tipo: AccidentType;
  fechaActuacion: string;
  horaActuacion: string;
  domicilioHecho: string;
  parteNumero: string;
  localidad: string;
  partido: string;
  motivo: string;
  perdidas: string;
  destino: CertificateDestination;
  razonSocial: string;
  numeroPoliza?: string | null;
  patenteVehiculo?: string | null;
  estado: RequestStatus;
  estadoArancel?: PaymentStatus;
  monto?: number | null;
  metodoPago?: PaymentMethod | null;
  motivoExento?: string | null;
  fechaPago?: string | null;
  motivoCancelacion?: string | null;
  canceladoEn?: string | null;
  firmadoEn?: string | null;
  retiradoEn?: string | null;
  retiradoPorNombre?: string | null;
  retiradoPorDni?: string | null;
};

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
    // Fíjate que ahora pasamos un array de roles: ['ADMIN']
    await this.seedUser('admin@centralbv.com', 'Admin123!', 'Super', 'Admin', ['ADMIN']);
    
    // Aquí le asignamos los dos roles para cumplir con la matriz de permisos
    await this.seedUser(
      'administrativo@centralbv.com',
      'Admin123!',
      'Usuario',
      'Administrativo',
      ['ADMINISTRATIVO', 'COMUN'], 
    );

    await this.seedCertificateRequests();
    await this.seedFleet();

    this.logger.log('Bootstrap finalizado.');
  }

  /**
   * Seeds vehicle catalogs and a small operative fleet if missing.
   * Denominaciones con el formato del cuartel (M-1, M-2…) y patentes en
   * forma canónica (ver fleet/domain/license-plate.ts).
   */
  private async seedFleet() {
    const typeIds = await this.seedVehicleTypes([
      'Autobomba',
      'Rescate',
      'Transporte de personal',
      'Ambulancia',
      'Van',
    ]);
    const brandIds = await this.seedVehicleBrands([
      'Iveco',
      'Mercedes-Benz',
      'Toyota',
      'Peugeot',
      'Ford',
      'Volkswagen',
      'Renault',
    ]);
    const modelIds = await this.seedVehicleModels([ 
      { valor: 'Tector', marca: 'Iveco' },
      { valor: 'Atego 1726', marca: 'Mercedes-Benz' },
      { valor: 'F-350', marca: 'Ford' },
      { valor: 'Hilux', marca: 'Toyota' },
      { valor: 'Master', marca: 'Renault' },
      { valor: 'Boxer', marca: 'Peugeot' },
    ], brandIds);

    await this.seedEmergencyVehicles([
      {
        denominacion: 'M-1',
        patente: 'AB123CD',
        tipo: 'Autobomba',
        marca: 'Iveco',
        modelo: 'Tector',
      },
      {
        denominacion: 'M-2',
        patente: 'AC456EF',
        tipo: 'Autobomba',
        marca: 'Mercedes-Benz',
        modelo: 'Atego 1726',
      },
      {
        denominacion: 'M-3',
        patente: 'AD789GH',
        tipo: 'Rescate',
        marca: 'Ford',
        modelo: 'F-350',
      },
      {
        denominacion: 'M-4',
        patente: 'AE234JK',
        tipo: 'Transporte de personal',
        marca: 'Toyota',
        modelo: 'Hilux',
      },
      {
        denominacion: 'M-5',
        patente: 'AF567LM',
        tipo: 'Ambulancia',
        marca: 'Renault',
        modelo: 'Master',
      },
      {
        denominacion: 'M-6',
        patente: 'AG890NP',
        tipo: 'Van',
        marca: 'Peugeot',
        modelo: 'Boxer',
      },
    ], typeIds, brandIds, modelIds);
  }

  private async seedVehicleTypes(
    valores: string[],
  ): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (const valor of valores) {
      const { data: existing } = await this.db
        .from('tipos_vehiculo')
        .select('id')
        .eq('valor', valor)
        .maybeSingle();
      if (existing) {
        ids[valor] = existing.id;
        continue;
      }
      const { data, error } = await this.db
        .from('tipos_vehiculo')
        .insert([{ valor, activo: true }])
        .select('id')
        .single();
      if (error) {
        this.logger.error(`Error creando tipo "${valor}": ${error.message}`);
        continue;
      }
      ids[valor] = data.id;
      this.logger.log(`Tipo de vehículo creado: ${valor}`);
    }
    return ids;
  }

  private async seedVehicleBrands(
    valores: string[],
  ): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (const valor of valores) {
      const { data: existing } = await this.db
        .from('marcas_vehiculo')
        .select('id')
        .eq('valor', valor)
        .maybeSingle();
      if (existing) {
        ids[valor] = existing.id;
        continue;
      }
      const { data, error } = await this.db
        .from('marcas_vehiculo')
        .insert([{ valor, activo: true }])
        .select('id')
        .single();
      if (error) {
        this.logger.error(`Error creando marca "${valor}": ${error.message}`);
        continue;
      }
      ids[valor] = data.id;
      this.logger.log(`Marca de vehículo creada: ${valor}`);
    }
    return ids;
  }

  private async seedVehicleModels(
    models: { valor: string; marca: string }[],
    brandIds: Record<string, string>,
  ): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (const model of models) {
      const marcaId = brandIds[model.marca];
      if (marcaId == null) {
        this.logger.error(
          `No se puede crear modelo "${model.valor}": falta marca ${model.marca}`,
        );
        continue;
      }
      const key = `${model.marca}:${model.valor}`;
      const { data: existing } = await this.db
        .from('modelos_vehiculo')
        .select('id')
        .eq('valor', model.valor)
        .eq('marca_id', marcaId)
        .maybeSingle();
      if (existing) {
        ids[key] = existing.id;
        continue;
      }
      const { data, error } = await this.db
        .from('modelos_vehiculo')
        .insert([{ valor: model.valor, marca_id: marcaId, activo: true }])
        .select('id')
        .single();
      if (error) {
        this.logger.error(
          `Error creando modelo "${model.valor}": ${error.message}`,
        );
        continue;
      }
      ids[key] = data.id;
      this.logger.log(`Modelo de vehículo creado: ${model.valor} (${model.marca})`);
    }
    return ids;
  }

  private async seedEmergencyVehicles(
    vehicles: {
      denominacion: string;
      patente: string;
      tipo: string;
      marca: string;
      modelo: string;
    }[],
    typeIds: Record<string, string>,
    brandIds: Record<string, string>,
    modelIds: Record<string, string>,
  ) {
    for (const v of vehicles) {
      const { data: existing } = await this.db
        .from('vehiculos_emergencia')
        .select('id')
        .eq('patente', v.patente)
        .maybeSingle();
      if (existing) continue;

      const tipoId = typeIds[v.tipo];
      const marcaId = brandIds[v.marca];
      const modeloId = modelIds[`${v.marca}:${v.modelo}`];
      if (tipoId == null || marcaId == null || modeloId == null) {
        this.logger.error(
          `No se puede crear móvil "${v.denominacion}": faltan catálogos`,
        );
        continue;
      }

      const { error } = await this.db.from('vehiculos_emergencia').insert([
        {
          denominacion: v.denominacion,
          patente: v.patente,
          estado: 'OPERATIVO',
          tipo_id: tipoId,
          marca_id: marcaId,
          modelo_id: modeloId,
          motivo_baja: null,
        },
      ]);
      if (error) {
        this.logger.error(
          `Error creando móvil "${v.denominacion}": ${error.message}`,
        );
        continue;
      }
      this.logger.log(`Móvil operativo creado: ${v.denominacion} (${v.patente})`);
    }
  }

  private async seedRoles() {
    const roles = [
      { nombre: 'COMUN', descripcion: 'Ver móviles - Marcar Operativo/Fuera de servicio' },
      { nombre: 'AUTOMOTORES', descripcion: 'Alta, baja y modificación de móviles.' },
      // Corregí el texto corrupto de esta descripción
      { nombre: 'ADMINISTRATIVO', descripcion: 'Todas las capacidades de COMUN + acceso al módulo de constancias.' },
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
  private async seedUser(
    email: string,
    pass: string,
    nombre: string,
    apellido: string,
    roleNames: string[], // <-- Ahora recibe un array de roles
  ) {
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

      // 4. Assign ALL roles from the array
      for (const roleName of roleNames) {
        const { data: roleData } = await this.db.from('roles').select('id').eq('nombre', roleName).single();
        if (roleData && userId) {
          await this.db.from('usuario_rol').upsert(
            [{ usuario_id: userId, rol_id: roleData.id }],
            { onConflict: 'usuario_id,rol_id' }
          );
        } else {
          this.logger.warn(`⚠️ No se encontró el rol "${roleName}" para asignar a ${email}`);
        }
      }

      this.logger.log(`✅ Usuario asegurado: ${email} con roles: [${roleNames.join(', ')}]`);
    } catch (error) {
      this.logger.error(`❌ Error asegurando usuario ${email}: ` + (error instanceof Error ? error.message : String(error)));
    }
  }

  /** Inserts sample certificate requests once; skipped if any already exist. */
  private async seedCertificateRequests() {
    const { count, error: countError } = await this.db
      .from('constancias')
      .select('id', { count: 'exact', head: true });
    if (countError) {
      this.logger.error(`❌ Error contando constancias: ${countError.message}`);
      return;
    }
    if ((count ?? 0) > 0) {
      this.logger.log('Constancias ya existentes, se omite seed de solicitudes.');
      return;
    }

    const { data: adminUser } = await this.db
      .from('usuarios')
      .select('id')
      .eq('email', 'administrativo@centralbv.com')
      .maybeSingle();
    const creadoPor = adminUser?.id ?? null;

    const seeds: SeedRequest[] = [
      {
        damnificado: {
          dni: '30112456',
          nombre: 'Lucía Fernández',
          telefono: '11 5555-0142',
        },
        tipo: 'VIVIENDA',
        fechaActuacion: '2026-09-12',
        horaActuacion: '14:30',
        domicilioHecho: 'Calle San Martín 450',
        parteNumero: 'P-2026-0001',
        localidad: 'Morón',
        partido: 'Morón',
        motivo: 'Constancia para el seguro del hogar',
        perdidas: 'Daños en cocina y artefactos',
        destino: 'SEGURO',
        razonSocial: 'La Caja Seguros',
        numeroPoliza: 'POL-100001',
        estado: 'PENDIENTE',
      },
      {
        damnificado: {
          dni: '28456789',
          nombre: 'Martín Gómez',
          telefono: '11 4000-2211',
        },
        tipo: 'VEHICULAR',
        fechaActuacion: '2026-09-18',
        horaActuacion: '09:15',
        domicilioHecho: 'Av. Rivadavia y Boyacá',
        parteNumero: 'P-2026-0002',
        localidad: 'CABA',
        partido: 'Comuna 6',
        motivo: 'Constancia para el seguro del vehículo',
        perdidas: 'Daños en paragolpes y óptica',
        destino: 'SEGURO',
        razonSocial: 'La Caja Seguros',
        numeroPoliza: 'POL-100002',
        patenteVehiculo: 'AB123CD',
        estado: 'PENDIENTE',
      },
      {
        damnificado: {
          dni: '35987654',
          nombre: 'Carla Ruiz',
          telefono: null,
        },
        tipo: 'VEHICULAR',
        fechaActuacion: '2026-09-22',
        horaActuacion: '21:05',
        domicilioHecho: 'Autopista Riccheri km 12',
        parteNumero: 'P-2026-0003',
        localidad: 'Ezeiza',
        partido: 'Ezeiza',
        motivo: 'Constancia para acción social',
        perdidas: 'Daños en carrocería',
        destino: 'ACCION_SOCIAL',
        razonSocial: 'Acción Social Morón',
        patenteVehiculo: 'AC456DE',
        estado: 'PENDIENTE',
      },
      {
        damnificado: {
          dni: '27111222',
          nombre: 'Diego Pereyra',
          telefono: '11 4788-9900',
        },
        tipo: 'VIVIENDA',
        fechaActuacion: '2026-08-30',
        horaActuacion: '03:40',
        domicilioHecho: 'Belgrano 890',
        parteNumero: 'P-2026-0004',
        localidad: 'Morón',
        partido: 'Morón',
        motivo: 'Constancia para el seguro',
        perdidas: 'Daños por agua en planta baja',
        destino: 'SEGURO',
        razonSocial: 'La Caja Seguros',
        numeroPoliza: 'POL-100004',
        estado: 'REALIZADA',
      },
      {
        damnificado: {
          dni: '32123456',
          nombre: 'Sofía Acosta',
          telefono: '11 6123-4455',
        },
        tipo: 'VEHICULAR',
        fechaActuacion: '2026-08-15',
        horaActuacion: '16:50',
        domicilioHecho: 'Mitre y Alsina',
        parteNumero: 'P-2026-0005',
        localidad: 'Morón',
        partido: 'Morón',
        motivo: 'Constancia para el seguro',
        perdidas: 'Abolladura en puerta lateral',
        destino: 'SEGURO',
        razonSocial: 'La Caja Seguros',
        numeroPoliza: 'POL-100005',
        patenteVehiculo: 'AD789FG',
        estado: 'REALIZADA',
        estadoArancel: 'ABONADO',
        monto: 1500,
        metodoPago: 'EFECTIVO',
        fechaPago: '2026-08-16T11:00:00.000Z',
      },
      {
        damnificado: {
          dni: '29888777',
          nombre: 'Javier Morales',
          telefono: '11 5555-7788',
        },
        tipo: 'VEHICULAR',
        fechaActuacion: '2026-07-28',
        horaActuacion: '18:20',
        domicilioHecho: 'Ruta 205 y Camino de Cintura',
        parteNumero: 'P-2026-0006',
        localidad: 'La Matanza',
        partido: 'La Matanza',
        motivo: 'Constancia para el seguro',
        perdidas: 'Daños en motocicleta',
        destino: 'SEGURO',
        razonSocial: 'La Caja Seguros',
        numeroPoliza: 'POL-100006',
        patenteVehiculo: 'A123BCD',
        estado: 'FIRMADA',
        estadoArancel: 'ABONADO',
        monto: 2200.5,
        metodoPago: 'TRANSFERENCIA',
        fechaPago: '2026-07-29T15:30:00.000Z',
        firmadoEn: '2026-07-30T12:00:00.000Z',
      },
      {
        damnificado: {
          dni: '33445566',
          nombre: 'Valentina Sosa',
          telefono: '11 4001-2233',
        },
        tipo: 'VIVIENDA',
        fechaActuacion: '2026-07-10',
        horaActuacion: '11:00',
        domicilioHecho: 'Sarmiento 2100',
        parteNumero: 'P-2026-0007',
        localidad: 'Morón',
        partido: 'Morón',
        motivo: 'Constancia para acción social',
        perdidas: 'Daños por humo en living',
        destino: 'ACCION_SOCIAL',
        razonSocial: 'Acción Social Morón',
        estado: 'FIRMADA',
        estadoArancel: 'EXENTO',
        motivoExento: 'Beneficiario de acción social',
        fechaPago: '2026-07-11T10:00:00.000Z',
        firmadoEn: '2026-07-12T09:30:00.000Z',
      },
      {
        damnificado: {
          dni: '26554321',
          nombre: 'Ricardo Benítez',
          telefono: '11 4777-1010',
        },
        tipo: 'VEHICULAR',
        fechaActuacion: '2026-06-20',
        horaActuacion: '08:10',
        domicilioHecho: 'Av. San Juan 1500',
        parteNumero: 'P-2026-0008',
        localidad: 'CABA',
        partido: 'Comuna 3',
        motivo: 'Constancia para el seguro',
        perdidas: 'Daños en paragolpes trasero',
        destino: 'SEGURO',
        razonSocial: 'La Caja Seguros',
        numeroPoliza: 'POL-100008',
        patenteVehiculo: 'AE321HI',
        estado: 'RETIRADA',
        estadoArancel: 'ABONADO',
        monto: 1800,
        metodoPago: 'DEBITO',
        fechaPago: '2026-06-21T14:00:00.000Z',
        firmadoEn: '2026-06-22T10:00:00.000Z',
        retiradoEn: '2026-06-23T16:45:00.000Z',
        retiradoPorNombre: 'Ricardo Benítez',
        retiradoPorDni: '26554321',
      },
      {
        damnificado: {
          dni: '31222333',
          nombre: 'Paula Herrera',
          telefono: null,
        },
        tipo: 'VIVIENDA',
        fechaActuacion: '2026-06-05',
        horaActuacion: '22:15',
        domicilioHecho: 'Calle Italia 55',
        parteNumero: 'P-2026-0009',
        localidad: 'Morón',
        partido: 'Morón',
        motivo: 'Constancia para acción social',
        perdidas: 'Daños en tablero eléctrico',
        destino: 'ACCION_SOCIAL',
        razonSocial: 'Acción Social Morón',
        estado: 'RETIRADA',
        estadoArancel: 'EXENTO',
        motivoExento: 'Jubilada en situación de vulnerabilidad',
        fechaPago: '2026-06-06T09:00:00.000Z',
        firmadoEn: '2026-06-07T11:20:00.000Z',
        retiradoEn: '2026-06-08T17:00:00.000Z',
        retiradoPorNombre: 'María Herrera',
        retiradoPorDni: '18555666',
      },
      {
        damnificado: {
          dni: '27666777',
          nombre: 'Andrés Quiroga',
          telefono: '11 5222-3344',
        },
        tipo: 'VEHICULAR',
        fechaActuacion: '2026-05-14',
        horaActuacion: '13:25',
        domicilioHecho: 'Av. Constitución y 9 de Julio',
        parteNumero: 'P-2026-0010',
        localidad: 'CABA',
        partido: 'Comuna 1',
        motivo: 'Solicitud cancelada',
        perdidas: 'Sin pérdidas registradas',
        destino: 'SEGURO',
        razonSocial: 'La Caja Seguros',
        numeroPoliza: 'POL-100010',
        patenteVehiculo: 'AF654JK',
        estado: 'CANCELADA',
        motivoCancelacion: 'El pedido no corresponde a una intervención del cuartel.',
        canceladoEn: '2026-05-15T10:00:00.000Z',
      },
    ];

    let created = 0;
    for (const seed of seeds) {
      try {
        const { data: damnificado, error: victimError } = await this.db
          .from('damnificados')
          .insert([seed.damnificado])
          .select('id')
          .single();
        if (victimError || !damnificado) {
          throw victimError ?? new Error('No se pudo crear el damnificado');
        }

        const { error: constanciaError } = await this.db.from('constancias').insert([
          {
            damnificado_id: damnificado.id,
            creado_por: creadoPor,
            tipo_constancia: seed.tipo,
            fecha_actuacion: seed.fechaActuacion,
            hora_actuacion: seed.horaActuacion,
            domicilio_hecho: seed.domicilioHecho,
            razon_social: seed.razonSocial,
            parte_numero: seed.parteNumero,
            localidad: seed.localidad,
            partido: seed.partido,
            motivo: seed.motivo,
            perdidas: seed.perdidas,
            destino: seed.destino,
            numero_poliza: seed.numeroPoliza ?? null,
            patente_vehiculo: seed.patenteVehiculo ?? null,
            estado: seed.estado,
            estado_arancel: seed.estadoArancel ?? 'PENDIENTE',
            monto: seed.monto ?? null,
            metodo_pago: seed.metodoPago ?? null,
            motivo_exento: seed.motivoExento ?? null,
            fecha_pago: seed.fechaPago ?? null,
            motivo_cancelacion: seed.motivoCancelacion ?? null,
            cancelado_en: seed.canceladoEn ?? null,
            firmado_en: seed.firmadoEn ?? null,
            retirado_en: seed.retiradoEn ?? null,
            retirado_por_nombre: seed.retiradoPorNombre ?? null,
            retirado_por_dni: seed.retiradoPorDni ?? null,
          },
        ]);
        if (constanciaError) {
          await this.db.from('damnificados').delete().eq('id', damnificado.id);
          throw constanciaError;
        }
        created += 1;
      } catch (error) {
        this.logger.error(
          `❌ Error creando solicitud seed (${seed.damnificado.nombre}): ` +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }

    this.logger.log(`✅ Solicitudes de constancia sembradas: ${created}/${seeds.length}`);
  }
}