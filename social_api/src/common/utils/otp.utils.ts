import { randomInt } from 'crypto';

/**
 * Sinh mã OTP gồm `length` chữ số (mặc định 6), dùng nguồn ngẫu nhiên mật mã.
 * Trả về chuỗi, giữ số 0 ở đầu (vd "004271").
 */
export const generateOtp = (length = 6): string => {
  const max = 10 ** length; // 6 số -> 0..999999
  return randomInt(0, max).toString().padStart(length, '0');
};
