import { Provider } from '@/generated/prisma/client';

export class CreateUserDto {
  username!: string;
  displayName!: string;
  email!: string;

  passwordHash?: string; // local: có hash; OAuth: để trống

  avatarUrl?: string;

  // OAuth: đi kèm để tạo bản ghi UserProvider
  provider?: Provider;
  providerUserId?: string;
}
