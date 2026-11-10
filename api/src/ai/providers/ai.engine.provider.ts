import {
  Injectable,
  Logger,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RagRequest, RagResponse } from '../orchestrator/orchestration.type';

export interface IngestRequestPayload {
  document_id?: string;
  knowledge_base_id: string;
  filename: string;
  content: string;
  background?: boolean;
}

export interface IngestResponsePayload {
  document_id: string;
  filename: string;
  chunks_created: number;
  status: string;
  message?: string;
}

@Injectable()
export class AiEngineProvider {
  private readonly baseUrl: string;
  private readonly logger = new Logger(AiEngineProvider.name);

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
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new GatewayTimeoutException('AI processing timeout');
      }

      throw new ServiceUnavailableException('AI Engine unavailable');
    }
  }

  async queryStream(request: RagRequest): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/api/v1/rag/query/stream`,
          request,
          { responseType: 'stream' },
        ),
      );

      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new GatewayTimeoutException('AI streaming timeout');
      }

      throw new ServiceUnavailableException('AI Engine streaming unavailable');
    }
  }

  async triggerIngest(payload: IngestRequestPayload): Promise<IngestResponsePayload> {
    try {
      const response = await firstValueFrom(
        this.http.post<IngestResponsePayload>(
          `${this.baseUrl}/api/v1/documents/ingest-text`,
          payload,
        ),
      );
      this.logger.log(`Ingestion triggered for document ${response.data.document_id}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to trigger ingestion: ${error.message}`);
      throw new ServiceUnavailableException('AI Ingestion service unavailable');
    }
  }

  async uploadPdf(
    documentId: string,
    knowledgeBaseId: string,
    filename: string,
    fileBuffer: Buffer,
    background: boolean = true,
  ): Promise<IngestResponsePayload> {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
      formData.append('file', blob, filename);
      formData.append('knowledge_base_id', knowledgeBaseId);
      formData.append('document_id', documentId);
      formData.append('background', background ? 'true' : 'false');

      const response = await firstValueFrom(
        this.http.post<IngestResponsePayload>(
          `${this.baseUrl}/api/v1/documents/upload-pdf`,
          formData,
        ),
      );
      this.logger.log(`PDF upload triggered for document ${documentId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to upload PDF to AI engine: ${error.message}`);
      throw new ServiceUnavailableException('AI PDF Ingestion service unavailable');
    }
  }
}
