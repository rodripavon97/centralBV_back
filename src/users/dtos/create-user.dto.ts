import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @ApiProperty({ example: 'Perez' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido: string;

  @ApiProperty({ example: 'juan@centralbv.com' })
  @IsEmail({}, { message: 'Debe ser un correo válido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Temporal123!' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
  })
  password: string;

  @ApiProperty({ example: 'ADMINISTRATIVO', description: 'Nombre exacto del rol' })
  @IsString()
  @IsNotEmpty({ message: 'Debe seleccionar un rol' })
  roleName: string;
}