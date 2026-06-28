import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';

export type User = {
  id: number;
  username: string;
  password: string;
};
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<User | null> {
    const user = (await this.authService.validateUser(
      username,
      password,
    )) as User;
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
