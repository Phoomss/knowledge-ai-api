import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptBuilderService {
  build(input: {
    question: string;
    context: string[];
    history: string[];
  }): string {
    const context = input.context.join('\n\n');

    const history = input.history.join('\n');

    return `
You are a helpful AI assistant.

Use the provided context to answer the question.

If the answer is not available in the context,
clearly state that you do not have enough information.

CONTEXT:
${context}

CONVERSATION HISTORY:
${history}

QUESTION:
${input.question}

ANSWER:
`;
  }
}
