import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MeEntity, UserProfileEntity } from './entities/user.entity';
import { PrismaService } from '@/database/prisma/prisma.service';
import { Prisma, User } from '@/database/generated/prisma/client';
import { comparePassword, hashPassword } from '@/common/utils/password.utils';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dùng nội bộ cho Auth ──────────────────────────────────────────

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { provider, providerUserId, ...data } = createUserDto;
    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          providers:
            provider && providerUserId
              ? { create: { provider, providerUserId } }
              : undefined,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = Array.isArray(e.meta?.target)
          ? (e.meta.target as string[]).join(', ')
          : 'Thông tin';
        throw new ConflictException(`${target} đã tồn tại`);
      }
      throw e;
    }
  }

  async findOneByUserEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // ── Nghiệp vụ hồ sơ ───────────────────────────────────────────────

  /** Hồ sơ đầy đủ của chính mình */
  async getMe(userId: number): Promise<MeEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    return MeEntity.from(user);
  }

  /** Hồ sơ công khai theo username */
  async getByUsername(username: string): Promise<UserProfileEntity> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    return UserProfileEntity.from(user);
  }

  /** Cập nhật hồ sơ của chính mình (chỉ các field cho phép) */
  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<MeEntity> {
    const user = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
      },
    });
    return MeEntity.from(user);
  }

  /** Đổi mật khẩu; thu hồi mọi refresh token để đăng xuất các thiết bị khác */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản đăng nhập qua mạng xã hội, không dùng mật khẩu',
      );
    }

    const isMatch = await comparePassword(dto.oldPassword, user.passwordHash);
    if (!isMatch) throw new BadRequestException('Mật khẩu cũ không đúng');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(dto.newPassword) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });

    return { message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại' };
  }

  /** Vô hiệu hóa tài khoản của chính mình (soft delete) */
  async deactivate(userId: number): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { isActive: false },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: BigInt(userId), revoked: false },
      data: { revoked: true },
    });
    return { message: 'Đã vô hiệu hóa tài khoản' };
  }
}
