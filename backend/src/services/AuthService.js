import jwt from 'jsonwebtoken';
import { gcpService } from './GcpService.js';
import { CryptoService } from '../utils/crypto.js';
import { User } from '../models/User.js';
import { config } from '../config/index.js';
import { UnauthorizedError, ConflictError } from '../utils/errors.js';

export class AuthService {
  constructor() {
    this.usersCollection = gcpService.firestore.collection('users');
  }

  async register(dto) {
    const existing = await this.usersCollection
      .where('email', '==', dto.email)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await CryptoService.hashPassword(dto.password);
    const userId = CryptoService.generateId();
    const now = new Date().toISOString();

    const user = new User({
      id: userId,
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roles: ['user'],
      createdAt: now,
      updatedAt: now,
    });

    await this.usersCollection.doc(userId).set(user.toFirestore());

    const token = this.generateToken(user);
    return { token, user: this.sanitizeUser(user) };
  }

  async login(dto) {
    const snapshot = await this.usersCollection
      .where('email', '==', dto.email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const user = User.fromFirestore(doc.id, data);

    const valid = await CryptoService.comparePassword(dto.password, data.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = this.generateToken(user);
    return { token, user: this.sanitizeUser(user) };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const doc = await this.usersCollection.doc(decoded.sub).get();
      
      if (!doc.exists) {
        throw new UnauthorizedError('User not found');
      }

      return { userId: decoded.sub, ...decoded };
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  generateToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  sanitizeUser(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      orgMemberships: user.orgMemberships,
    };
  }
}
