import { ConfigService } from '@nestjs/config';
import { comparePassword, hashPassword } from '@/common/utils/password.utils';
import { UsersService } from '@/users/users.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import ms, { StringValue } from 'ms';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly ConfigService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async generateToken(user: User) {
    const Payload = {
      sub: user.id.toString(),
      username: user.username,
      displayName: user.displayName,
    };

    const accessToken = await this.jwtService.signAsync(Payload);

    const refreshToken = await this.jwtService.signAsync(Payload, {
      secret: this.ConfigService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: ms(
        this.ConfigService.get<StringValue>('REFRESH_TOKEN_EXPIRATION', '7d'),
      ),
    });
    const tokenHash = await hashPassword(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(
          Date.now() +
            ms(
              this.ConfigService.get<StringValue>(
                'REFRESH_TOKEN_EXPIRATION',
                '7d',
              ),
            ),
        ),
      },
    });

    return { accessToken, refreshToken };
  }
  async validateUser(username: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findOneByUserEmail(username);
    if (!user) return null;
    if (!user.passwordHash) return null;
    const isPasswordValid = await comparePassword(pass, user.passwordHash);
    if (!isPasswordValid) return null;
    return user;
  }
  async login(user: User) {
    const { accessToken, refreshToken } = await this.generateToken(user);
    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.ConfigService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const userId = BigInt(payload.sub);
    const stored = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
    let matched: (typeof stored)[number] | undefined;
    for (const record of stored) {
      if (await comparePassword(refreshToken, record.tokenHash)) {
        matched = record;
        break;
      }
    }
    if (!matched) {
      throw new UnauthorizedException('Refresh token not recognized');
    }
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revoked: true },
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return this.generateToken(user);
  }

  setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, // JS phía client KHÔNG đọc được -> chống XSS
      secure: this.ConfigService.get('NODE_ENV') === 'production', // dev=false để chạy http
      sameSite: 'lax', // chống CSRF cơ bản; dùng 'none' nếu FE/BE khác domain (kèm secure:true)
      path: '/auth', // cookie chỉ gửi cho các route /auth (login/refresh/logout)
      maxAge: ms(
        this.ConfigService.get<StringValue>('REFRESH_TOKEN_EXPIRATION') || '7d',
      ), // khớp hạn của refresh token
    });
  }
  clearRefreshCookie(res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.ConfigService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
    });
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.ConfigService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      return;
    }
    const stored = await this.prisma.refreshToken.findMany({
      where: {
        userId: BigInt(payload.sub),
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
    let matched: (typeof stored)[number] | undefined;
    for (const record of stored) {
      if (await comparePassword(refreshToken, record.tokenHash)) {
        matched = record;
        break;
      }
    }
    if (!matched) return;
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revoked: true },
    });
  }
}
