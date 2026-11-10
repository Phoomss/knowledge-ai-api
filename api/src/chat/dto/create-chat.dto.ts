import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class ChatQueryDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsUUID()
  knowledge_base_id: string;

  @IsOptional()
  @IsUUID()
  conversation_id?: string;
}
