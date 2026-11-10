import {
  Injectable,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RagRequest, RagResponse } from '../orchestrator/orchestration.type';

@Injectable()
export class AiEngineProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow('AI_SERVICE_URL');
  }

  async query(request: RagRequest): Promise<RagResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<RagResponse>(
          `${this.baseUrl}/api/v1/rag/query`,
          request,
        ),
      );

      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new GatewayTimeoutException('AI processing timeout');
      }

      throw new ServiceUnavailableException('AI Engine unavailable');
    }
  }
}
