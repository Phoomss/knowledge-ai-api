import { Injectable } from '@nestjs/common';
import { AiOrchestratorService } from '../ai/orchestrator/ai-orchestrator.service';
import { ChatQueryDto } from './dto/create-chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly orchestrator: AiOrchestratorService) {}

  async sendMessage(dto: ChatQueryDto) {
    return this.orchestrator.execute({
      question: dto.question,
      knowledge_base_id: dto.knowledge_base_id,
      conversation_id: dto.conversation_id,
      options: {
        top_k: 5,
        use_reranker: true,
      },
    });
  }
}
