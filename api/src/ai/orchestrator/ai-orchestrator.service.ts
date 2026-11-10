import { Injectable } from '@nestjs/common';
import { AiEngineProvider } from '../providers/ai.engine.provider';
import { RagRequest, RagResponse } from './orchestration.type';

@Injectable()
export class AiOrchestratorService {
  constructor(private readonly aiEngine: AiEngineProvider) {}

  async execute(request: RagRequest): Promise<RagResponse> {
    // Step 1: Validate request
    if (!request.question.trim()) {
      throw new Error('Question is required');
    }

    // Step 2: Select AI Strategy
    const strategy = 'RAG';

    // Step 3: Execute AI workflow
    if (strategy === 'RAG') {
      const result = await this.aiEngine.query(request);

      // Step 4: Validate response
      if (!result.answer) {
        throw new Error('AI returned empty answer');
      }

      // Step 5: Return result
      return result;
    }

    throw new Error('Unsupported AI strategy');
  }

  async executeStream(request: RagRequest): Promise<any> {
    if (!request.question.trim()) {
      throw new Error('Question is required');
    }

    return this.aiEngine.queryStream(request);
  }
}
