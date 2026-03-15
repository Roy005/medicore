import { IsEmail, IsNotEmpty, IsString, MinLength, IsUUID } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsUUID()
  @IsNotEmpty()
  tenantId!: string;
}
