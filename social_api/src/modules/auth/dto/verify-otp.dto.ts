import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Mã OTP gồm 6 chữ số' })
  @IsNotEmpty({ message: 'Mã OTP is required' })
  code!: string;
}
