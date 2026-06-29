import { ConfigService } from '@nestjs/config';
import { comparePassword, hashPassword } from '@/common/utils/password.utils';
import { generateOtp } from '@/common/utils/otp.utils';
import { UsersService } from '@/users/users.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import ms, { StringValue } from 'ms';
import { Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly ConfigService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
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

  async validateUser({ email, password }: LoginDto): Promise<User | null> {
    const user = await this.usersService.findOneByUserEmail(email);
    if (!user) return null;
    if (!user.passwordHash) return null;
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) return null;
    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }
    if (!user.isVerified) {
      throw new ForbiddenException('Tài khoản chưa được xác thực');
    }
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

  async register(registerDto: RegisterDto) {
    const { username, displayName, email, password } = registerDto;
    const existingUser = await this.usersService.findOneByUserEmail(email);
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const hashedPassword = await hashPassword(password);
    const user = await this.usersService.create({
      username,
      displayName,
      email,
      passwordHash: hashedPassword,
    });

    // Gửi OTP nhưng không để lỗi mail làm hỏng việc đăng ký (user đã tạo xong)
    try {
      await this.sendVerificationOtp(user);
    } catch (e) {
      console.error('Gửi OTP xác minh thất bại:', e);
    }

    return {
      id: user.id.toString(),
      email: user.email,
      message: 'Đăng ký thành công, vui lòng kiểm tra email để lấy mã xác minh',
    };
  }

  // Sinh mã OTP, băm và lưu DB, rồi gửi qua email
  async sendVerificationOtp(user: User): Promise<void> {
    const expiresMinutes = this.ConfigService.get<number>(
      'OTP_EXPIRES_MINUTES',
      10,
    );
    const code = generateOtp(6);
    const codeHash = await hashPassword(code);

    // Mỗi user chỉ giữ 1 mã hiệu lực -> xóa mã cũ trước khi tạo mã mới
    await this.prisma.emailVerification.deleteMany({
      where: { userId: user.id },
    });
    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
      },
    });

    await this.mailService.sendVerificationOtp(
      user.email,
      user.displayName,
      code,
      expiresMinutes,
    );
  }

  // Kiểm tra mã người dùng nhập, đúng thì đánh dấu đã xác minh
  async verifyOtp(email: string, code: string) {
    const user = await this.usersService.findOneByUserEmail(email);
    if (!user) {
      throw new BadRequestException('Email không tồn tại');
    }
    if (user.isVerified) {
      return { message: 'Tài khoản đã được xác minh' }; // idempotent
    }

    const record = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new BadRequestException('Chưa có mã xác minh, hãy yêu cầu gửi lại');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Mã đã hết hạn, hãy yêu cầu gửi lại');
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Bạn đã nhập sai quá số lần cho phép, hãy yêu cầu gửi lại mã',
      );
    }

    const isMatch = await comparePassword(code, record.codeHash);
    if (!isMatch) {
      await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Mã xác minh không đúng');
    }

    // Đúng mã -> xác minh user và dọn sạch OTP
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
    await this.prisma.emailVerification.deleteMany({
      where: { userId: user.id },
    });

    return { message: 'Xác minh email thành công' };
  }

  // Gửi lại mã (luôn trả message giống nhau để không lộ email nào tồn tại)
  async resendOtp(email: string) {
    const message =
      'Nếu email hợp lệ và chưa xác minh, mã mới đã được gửi tới hộp thư';
    const user = await this.usersService.findOneByUserEmail(email);
    if (user && !user.isVerified) {
      await this.sendVerificationOtp(user);
    }
    return { message };
  }
}
