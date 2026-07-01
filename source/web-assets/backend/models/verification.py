from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone

class VerificationRequest(BaseModel):
    verification_id: str
    user_id: str
    document_type: Literal["drivers_license", "passport", "national_id"]
    document_url: str  # URL to uploaded document photo
    selfie_url: str  # URL to uploaded selfie for comparison
    status: Literal["pending", "approved", "denied"] = "pending"
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None  # Admin user_id who reviewed
    extracted_dob: Optional[str] = None  # Date of birth from document
    verification_notes: Optional[str] = None  # Admin notes
    rejection_reason: Optional[str] = None  # Reason if denied

class VerificationUpload(BaseModel):
    document_type: Literal["drivers_license", "passport", "national_id"]
    document_url: str
    selfie_url: str

class VerificationReview(BaseModel):
    verification_id: str
    status: Literal["approved", "denied"]
    extracted_dob: Optional[str] = None
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


# ==================== DRIVER LICENSE VERIFICATION MODELS ====================

class DriverLicenseVerification(BaseModel):
    verification_id: str
    user_id: str
    license_url: str  # URL to uploaded driver's license photo
    selfie_url: str  # URL to uploaded selfie for identity verification
    status: Literal["pending", "approved", "denied"] = "pending"
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None  # Admin user_id who reviewed
    license_number_last4: Optional[str] = None  # Last 4 digits of license number
    license_expiry_date: Optional[str] = None  # Expiration date from license
    license_state: Optional[str] = None  # State/province of license
    verification_notes: Optional[str] = None  # Admin notes
    rejection_reason: Optional[str] = None  # Reason if denied

class DriverLicenseUpload(BaseModel):
    license_url: str
    selfie_url: str

class DriverLicenseReview(BaseModel):
    verification_id: str
    status: Literal["approved", "denied"]
    license_number_last4: Optional[str] = None
    license_expiry_date: Optional[str] = None
    license_state: Optional[str] = None
    verification_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
