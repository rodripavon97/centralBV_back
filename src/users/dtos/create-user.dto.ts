import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Matches(/^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'El nombre solo puede contener letras y espacios',
  })
  nombre: string;

  @ApiProperty({ example: 'Perez' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  @Matches(/^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'El apellido solo puede contener letras y espacios',
  })
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

  @ApiProperty({
    example: 'administrativo',
    description: 'Rol del usuario: administrativo, comun, automotores o admin',
    enum: ['administrativo', 'comun', 'automotores', 'admin'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Debe seleccionar un rol' })
  @IsIn(['administrativo', 'comun', 'automotores', 'admin'], {
    message: 'El rol debe ser uno de: administrativo, comun, automotores, admin',
  })
  roleName: string;
}