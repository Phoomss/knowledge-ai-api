import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { PrismaService } from '../database/prisma.service';

describe('KnowledgeBasesService', () => {
  let service: KnowledgeBasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBasesService,
        {
          provide: PrismaService,
          useValue: {
            knowledgeBase: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<KnowledgeBasesService>(KnowledgeBasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
