import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationOtp(
    to: string,
    displayName: string,
    code: string,
    expiresMinutes: number,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Mã xác minh email',
      template: 'verify-otp', // khớp tên file templates/verify-otp.hbs
      context: { displayName, code, expiresMinutes },
    });
  }
}
