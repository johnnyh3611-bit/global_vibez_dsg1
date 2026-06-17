from pydantic import BaseModel


class ReferralApply(BaseModel):
    referral_code: str
