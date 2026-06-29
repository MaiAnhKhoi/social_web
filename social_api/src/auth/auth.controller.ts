import { Controller, Post, Req, Res } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { AuthService } from './auth.service';
import { User } from '@/generated/prisma/client';
import type { Response, Request } from 'express';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(@Req() req: { user: User; res: Response }) {
    const { accessToken, refreshToken } = await this.authService.login(
      req.user,
    );
    this.authService.setRefreshCookie(req.res, refreshToken);
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
}
