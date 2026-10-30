import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'NuevaClave123!' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Debe tener al menos una mayúscula, una minúscula y un número',
  })
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({ example: 'NuevaClave123!' })
  @IsString()
  @IsNotEmpty({ message: 'Debe confirmar la contraseña' })
  confirmPassword: string;

  @ApiProperty({ description: 'Access token extraído de la URL del correo (JWT)' })
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;
}