import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ChatQueryDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  knowledge_base_id: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;
}
