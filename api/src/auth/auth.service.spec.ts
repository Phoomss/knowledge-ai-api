import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwt: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: mock(),
        create: mock(),
      },
    };
    mockJwt = {
      sign: mock(() => 'mock-token'),
    };
    service = new AuthService(mockPrisma, mockJwt);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a new user successfully', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'uuid-123',
      email: 'user@test.com',
      name: 'Test User',
      role: 'USER',
      createdAt: new Date(),
    });

    const result = await service.register({
      email: 'user@test.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(result.access_token).toBe('mock-token');
    expect(result.user.email).toBe('user@test.com');
  });
});
