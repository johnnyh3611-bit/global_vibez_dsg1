from pydantic import BaseModel

class CheckoutSessionResponse(BaseModel):
    url: str

class CheckoutStatusResponse(BaseModel):
    status: str

class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str

class StripeCheckout:
    def __init__(self, api_key: str = None):
        self.api_key = api_key

    @staticmethod
    async def get_checkout_status(session_id: str):
        return CheckoutStatusResponse(status="active")

    @staticmethod
    async def create_checkout_session(data: CheckoutSessionRequest):
        return CheckoutSessionResponse(url="https://stripe.com/checkout")
