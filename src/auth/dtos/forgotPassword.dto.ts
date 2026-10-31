import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'lu-fernandez1@centralbv.com' })
  @IsEmail({}, { message: 'Debe ser un correo válido' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  email: string;
}