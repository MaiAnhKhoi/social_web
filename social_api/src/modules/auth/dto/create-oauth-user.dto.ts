import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Provider } from '@/database/generated/prisma/client';

export class CreateOAuthUserDto {
  @IsEmail({}, { message: 'Nhà cung cấp không trả về email hợp lệ' })
  @MaxLength(100)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @IsEnum(Provider)
  provider!: Provider; // GOOGLE | FACEBOOK | ...

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  providerUserId!: string; // id Google/FB -> lưu vào UserProvider

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;
}
