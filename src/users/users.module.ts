import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { SupabaseUserRepository } from './repositories/supabase-user.repository.js';
import { USER_REPOSITORY } from './domain/user.repository.js';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: SupabaseUserRepository,
    },
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}