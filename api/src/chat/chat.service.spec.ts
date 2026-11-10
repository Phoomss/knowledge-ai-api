import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { AiOrchestratorService } from '../ai/orchestrator/ai-orchestrator.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: AiOrchestratorService,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
