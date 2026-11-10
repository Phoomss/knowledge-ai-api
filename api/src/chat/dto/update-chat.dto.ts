import { PartialType } from '@nestjs/swagger';
import { ChatQueryDto } from './create-chat.dto';

export class UpdateChatDto extends PartialType(ChatQueryDto) {}
