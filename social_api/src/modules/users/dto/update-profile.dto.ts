import { IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Tên hiển thị từ 1–100 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Tiểu sử tối đa 1000 ký tự' })
  bio?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Avatar phải là URL hợp lệ' })
  @MaxLength(500)
  avatarUrl?: string;
}
