import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
