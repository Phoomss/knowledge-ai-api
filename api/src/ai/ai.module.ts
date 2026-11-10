import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiOrchestratorService } from './orchestrator/ai-orchestrator.service';
import { AiEngineProvider } from './providers/ai.engine.provider';
import { PromptBuilderService } from './prompts/prompt-builder.service';

@Module({
  imports: [HttpModule],
  providers: [AiOrchestratorService, AiEngineProvider, PromptBuilderService],
  exports: [AiOrchestratorService],
})
export class AiModule {}
