import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @Length(3, 30, { message: 'Username phải từ 3–30 ký tự' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username chỉ gồm chữ, số và _' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  username!: string;

  @IsString()
  @Length(1, 100)
  @Transform(({ value }: { value: string }) => value?.trim())
  displayName!: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72) // bcrypt chỉ băm 72 byte đầu -> chặn từ DTO cho rõ ràng
  password!: string;
}
