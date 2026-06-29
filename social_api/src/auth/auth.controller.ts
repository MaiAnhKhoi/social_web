import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { AuthService } from './auth.service';
import { User } from '@/generated/prisma/client';
import type { Response, Request } from 'express';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(
    @Req() req: Request & { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
    );
    this.authService.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('/refresh')
  async refresh(
    @Req() req: Request & { cookies: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.refresh(
      req.cookies['refreshToken'],
    );
    this.authService.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.cookies['refreshToken']);
    this.authService.clearRefreshCookie(res);
    return { message: 'Logout successfully' };
  }

  @Post('/register')
  async register(@Body() dto: RegisterDto) {
    const { username, displayName, email, password } = dto;
    const user = await this.authService.register({
      username,
      displayName,
      email,
      password,
    });
    return {
      message: `User ${user.username} registered successfully`,
    };
  }
}
