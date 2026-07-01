import { User, UserRole } from '@/database/generated/prisma/client';

/**
 * Hồ sơ công khai — an toàn để trả cho bất kỳ ai.
 * KHÔNG chứa passwordHash/email; id BigInt được ép sang string.
 */
export class UserProfileEntity {
  id!: string;
  username!: string;
  displayName!: string;
  avatarUrl!: string | null;
  bio!: string | null;
  createdAt!: Date;

  static from(user: User): UserProfileEntity {
    return {
      id: user.id.toString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
    };
  }
}

/**
 * Hồ sơ riêng của chính mình — kèm thông tin nhạy cảm hơn (email, role...).
 */
export class MeEntity extends UserProfileEntity {
  email!: string;
  role!: UserRole;
  isVerified!: boolean;
  isActive!: boolean;

  static from(user: User): MeEntity {
    return {
      ...UserProfileEntity.from(user),
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
    };
  }
}
