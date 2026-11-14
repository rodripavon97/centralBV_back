import { Module } from '@nestjs/common';
import { FleetService } from './fleet.service.js';
import { FleetController } from './fleet.controller.js';
import { VehicleCatalogService } from './vehicle-catalog.service.js';
import { VehicleCatalogController } from './vehicle-catalog.controller.js';
import { SupabaseVehicleCatalogRepository } from './repositories/supabase-vehicle-catalog.repository.js';
import { SupabaseEmergencyVehicleRepository } from './repositories/supabase-emergency-vehicle.repository.js';
import { SupabaseRevisionRepository } from './repositories/supabase-revision.repository.js';
import { VEHICLE_CATALOG_REPOSITORY } from './domain/vehicle-catalog.repository.js';
import { EMERGENCY_VEHICLE_REPOSITORY } from './domain/emergency-vehicle.repository.js';
import { REVISION_REPOSITORY } from './domain/revision.repository.js';
import { CompartmentService } from './compartment.service.js';
import { CompartmentController } from './compartment.controller.js';
import { SupabaseCompartmentRepository } from './repositories/supabase-compartment.repository.js';
import { COMPARTMENT_REPOSITORY } from './domain/compartment.repository.js';

@Module({
  controllers: [
    FleetController,
    VehicleCatalogController,
    CompartmentController,
  ],
  providers: [
    FleetService,
    VehicleCatalogService,
    CompartmentService,
    {
      provide: VEHICLE_CATALOG_REPOSITORY,
      useClass: SupabaseVehicleCatalogRepository,
    },
    {
      provide: EMERGENCY_VEHICLE_REPOSITORY,
      useClass: SupabaseEmergencyVehicleRepository,
    },
    {
      provide: REVISION_REPOSITORY,
      useClass: SupabaseRevisionRepository,
    },
    {
      provide: COMPARTMENT_REPOSITORY,
      useClass: SupabaseCompartmentRepository,
    },
  ],
})
export class FleetModule {}
