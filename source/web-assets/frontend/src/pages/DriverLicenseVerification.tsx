import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Camera, CheckCircle, AlertCircle, Shield, Car, IdCard } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DriverLicenseVerification() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: intro, 2: license, 3: selfie, 4: review, 5: submitted
  const [licenseFile, setLicenseFile] = useState(null);
  const [licensePreview, setLicensePreview] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [ageVerificationRequired, setAgeVerificationRequired] = useState(false);

  const handleLicenseUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setLicenseFile(file);
    setLicensePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSelfieUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async () => {
    setUploading(true);
    setError(null);

    try {
      // Upload driver license
      const licenseFormData = new FormData();
      licenseFormData.append('file', licenseFile);

      const licenseResponse = await fetch(`${API}/api/uploads/driver-license`, {
        method: 'POST',
        
        body: licenseFormData
      });

      if (!licenseResponse.ok) {
        throw new Error('Failed to upload driver license');
      }

      const licenseData = await licenseResponse.json();

      // Upload selfie
      const selfieFormData = new FormData();
      selfieFormData.append('file', selfieFile);

      const selfieResponse = await fetch(`${API}/api/uploads/driver-selfie`, {
        method: 'POST',
        
        body: selfieFormData
      });

      if (!selfieResponse.ok) {
        throw new Error('Failed to upload selfie');
      }

      const selfieData = await selfieResponse.json();

      // Submit driver license verification request
      const verificationResponse = await fetch(`${API}/api/driver-verification/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          license_url: licenseData.file_url,
          selfie_url: selfieData.file_url
        })
      });

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        
        // Check if age verification is required
        if (errorData.detail && errorData.detail.includes('age verification')) {
          setAgeVerificationRequired(true);
          throw new Error(errorData.detail);
        }
        
        throw new Error(errorData.detail || 'Failed to submit driver license verification');
      }

      setStep(5); // Move to success page
    } catch (err) {
      // console.error('Driver license verification error:', err);
      setError(err.message || 'Failed to submit driver license verification. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Step 1: Introduction
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <div className="text-center mb-8">
            <Car className="w-20 h-20 mx-auto mb-4 text-purple-300" />
            <h1 className="text-4xl font-bold text-white mb-3">Driver License Verification</h1>
            <p className="text-xl text-purple-200">
              Get verified to become a driver for Vibes Rides
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">What you'll need:</h3>
            <ul className="space-y-3 text-white/90">
              <li className="flex items-start gap-3">
                <IdCard className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>A valid driver's license (front side with photo clearly visible)</span>
              </li>
              <li className="flex items-start gap-3">
                <Camera className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>A clear selfie photo for identity verification</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Review typically takes 24-48 hours</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-100">
                <p className="font-semibold mb-1">Prerequisites</p>
                <p>You must be age verified (18+) before applying for driver verification. If you haven't completed age verification yet, please do that first.</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-100">
                <p className="font-semibold mb-1">Your privacy is protected</p>
                <p>Your driver's license is encrypted and only used for verification. We only store the last 4 digits of your license number.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() => setStep(2)}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-6 text-lg"
            >
              Continue to Verification
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Step 2: Upload Driver License
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">Upload Your Driver's License</h2>
          <p className="text-white/80 mb-6">
            Take a clear photo of the front of your driver's license. Make sure all text is readable.
          </p>

          {/* License Upload */}
          <div className="mb-6">
            {licensePreview ? (
              <div className="relative">
                <img
                  src={licensePreview}
                  alt="License preview"
                  className="w-full rounded-lg border-2 border-white/20"
                />
                <Button
                  onClick={() => {
                    setLicenseFile(null);
                    setLicensePreview(null);
                  }}
                  className="absolute top-4 right-4 bg-red-500 hover:bg-red-600"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <label className="block">
                <div className="border-2 border-dashed border-white/30 rounded-lg p-12 text-center cursor-pointer hover:border-purple-400 hover:bg-white/5 transition-all">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-purple-300" />
                  <p className="text-white font-semibold mb-2">Click to upload driver's license</p>
                  <p className="text-white/60 text-sm">JPG, PNG, or WebP (max 10MB)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLicenseUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              onClick={() => setStep(1)}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!licenseFile}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold disabled:opacity-50"
            >
              Next: Selfie
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Step 3: Upload Selfie
  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">Take a Selfie</h2>
          <p className="text-white/80 mb-6">
            Take a clear photo of your face to verify your identity matches the driver's license.
          </p>

          {/* Selfie Upload */}
          <div className="mb-6">
            {selfiePreview ? (
              <div className="relative">
                <img
                  src={selfiePreview}
                  alt="Selfie preview"
                  className="w-full max-w-md mx-auto rounded-lg border-2 border-white/20"
                />
                <Button
                  onClick={() => {
                    setSelfieFile(null);
                    setSelfiePreview(null);
                  }}
                  className="absolute top-4 right-4 bg-red-500 hover:bg-red-600"
                >
                  Retake
                </Button>
              </div>
            ) : (
              <label className="block">
                <div className="border-2 border-dashed border-white/30 rounded-lg p-12 text-center cursor-pointer hover:border-purple-400 hover:bg-white/5 transition-all">
                  <Camera className="w-16 h-16 mx-auto mb-4 text-purple-300" />
                  <p className="text-white font-semibold mb-2">Click to take selfie</p>
                  <p className="text-white/60 text-sm">Make sure your face is clearly visible</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleSelfieUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setStep(2)}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={!selfieFile}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold disabled:opacity-50"
            >
              Review & Submit
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Step 4: Review
  if (step === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">Review Your Submission</h2>

          <div className="space-y-6 mb-6">
            {/* License Preview */}
            <div>
              <h3 className="text-white font-semibold mb-2">Driver's License</h3>
              <img
                src={licensePreview}
                alt="License"
                className="w-full rounded-lg border-2 border-white/20"
              />
            </div>

            {/* Selfie Preview */}
            <div>
              <h3 className="text-white font-semibold mb-2">Selfie Photo</h3>
              <img
                src={selfiePreview}
                alt="Selfie"
                className="w-full max-w-md rounded-lg border-2 border-white/20"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200">{error}</p>
              {ageVerificationRequired && (
                <Button
                  onClick={() => navigate('/age-verification')}
                  className="mt-3 bg-blue-500 hover:bg-blue-600"
                >
                  Complete Age Verification First
                </Button>
              )}
            </div>
          )}

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
            <p className="text-purple-100 text-sm">
              By submitting, you confirm that the information provided is accurate and belongs to you.
              Your driver's license will be reviewed by our team within 24-48 hours. Once approved, you can register as a driver for Vibes Rides.
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => setStep(3)}
              disabled={uploading}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold"
            >
              {uploading ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Step 5: Success
  if (step === 5) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20 text-center">
          <CheckCircle className="w-24 h-24 mx-auto mb-6 text-green-400" />
          <h2 className="text-4xl font-bold text-white mb-4">Verification Submitted!</h2>
          <p className="text-xl text-white/80 mb-6">
            Your driver license verification request has been submitted successfully.
          </p>
          <p className="text-white/60 mb-8">
            Our team will review your driver's license within 24-48 hours. You'll receive an email once your verification is complete.
            Once approved, you'll be able to register as a driver for Vibes Rides and start earning!
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate('/driver-verification-status')}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 px-6 py-3"
            >
              Check Status
            </Button>
            <Button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold px-8 py-3"
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
