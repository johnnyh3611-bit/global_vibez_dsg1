from pydantic import BaseModel

class UserMessage(BaseModel):
    content: str

class LlmChat:
    def __init__(self, model: str = None, api_key: str = None, session_id: str = None):
        self.model = model
        self.api_key = api_key
        self.session_id = session_id

    @staticmethod
    def with_params(max_tokens=2048):
        return LlmChat()

    async def chat(self, messages):
        return "AI Response"
