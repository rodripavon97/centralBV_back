import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { SupabaseUserRepository } from './repositories/supabase-user.repository.js';
import { USER_REPOSITORY } from './domain/user.repository.js';
import { MailModule } from '../mail/mail.module.js';
import { EncryptionService } from '../common/security/encryption.service.js';

@Module({
  imports: [MailModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    EncryptionService,
    {
      provide: USER_REPOSITORY,
      useClass: SupabaseUserRepository,
    },
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}