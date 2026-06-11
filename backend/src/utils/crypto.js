import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

export class CryptoService {
  static hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  static comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  static generateId() {
    return randomUUID();
  }

  static generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
