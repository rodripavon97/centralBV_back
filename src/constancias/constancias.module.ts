import { Module } from '@nestjs/common';
import { ConstanciasController } from './constancias.controller.js';
import { ConstanciasService } from './constancias.service.js';
import { SupabaseSolicitudRepository } from './repositories/supabase-solicitud.repository.js';
import { SOLICITUD_REPOSITORY } from './domain/solicitud.repository.js';

@Module({
  controllers: [ConstanciasController],
  providers: [
    ConstanciasService,
    {
      provide: SOLICITUD_REPOSITORY,
      useClass: SupabaseSolicitudRepository,
    },
  ],
})
export class ConstanciasModule {}
