from google import genai
from google.genai import types

class GeminiProvider:
    def __init__(
        self,
        api_key: str,
        model: str,
    ):

        self.client = genai.Client(
            api_key=api_key,
        )

        self.model = model

    async def generate(
        self,
        prompt: str,
    ):

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=2048,
            ),
        )

        if not response.text:
            raise RuntimeError("LLM returned empty response")

        return response.text

    async def close(self):
        await self.client.aio.aclose()