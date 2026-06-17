import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Shield, CheckCircle2, AlertCircle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function IDVerificationUpload() {
  const navigate = useNavigate();
  const [documentType, setDocumentType] = useState("drivers_license");
  const [documentUrl, setDocumentUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleFileUpload = async (file, type) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/api/uploads/upload`, {
        method: "POST",
        body: formData,
        
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      
      if (type === "document") {
        setDocumentUrl(data.file_url);
      } else {
        setSelfieUrl(data.file_url);
      }
    } catch (err) {
      setError("Failed to upload file. Please try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setUploading(true);

    if (!documentUrl || !selfieUrl) {
      setError("Please upload both ID document and selfie");
      setUploading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/api/verification/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: documentType,
          document_url: documentUrl,
          selfie_url: selfieUrl,
        }),
        
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Verification submission failed");
      }

      setSuccess(true);
      setTimeout(() => navigate("/settings"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">ID Verification</h1>
          </div>

          <p className="text-gray-300 mb-6">
            Verify your identity to increase trust and unlock premium features. Your information is securely stored and reviewed by our team.
          </p>

          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <p className="text-green-300">Verification submitted! Redirecting...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Document Type
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="drivers_license">Driver's License</option>
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
              </select>
            </div>

            {/* ID Document Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload ID Document
              </label>
              <div className="border-2 border-dashed border-purple-500/30 rounded-xl p-6 text-center hover:border-cyan-500/50 transition-colors">
                {documentUrl ? (
                  <div>
                    <img src={documentUrl} alt="ID Document" className="max-h-48 mx-auto rounded-lg" />
                    <p className="text-green-400 mt-2">Document uploaded ✓</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e.target.files[0], "document")}
                      className="hidden"
                      id="document-upload"
                    />
                    <label
                      htmlFor="document-upload"
                      className="cursor-pointer text-cyan-400 hover:text-cyan-300"
                    >
                      Click to upload ID document
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Selfie Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload Selfie (Holding ID)
              </label>
              <div className="border-2 border-dashed border-purple-500/30 rounded-xl p-6 text-center hover:border-cyan-500/50 transition-colors">
                {selfieUrl ? (
                  <div>
                    <img src={selfieUrl} alt="Selfie" className="max-h-48 mx-auto rounded-lg" />
                    <p className="text-green-400 mt-2">Selfie uploaded ✓</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e.target.files[0], "selfie")}
                      className="hidden"
                      id="selfie-upload"
                    />
                    <label
                      htmlFor="selfie-upload"
                      className="cursor-pointer text-cyan-400 hover:text-cyan-300"
                    >
                      Click to upload selfie
                    </label>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || !documentUrl || !selfieUrl}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {uploading ? "Submitting..." : "Submit for Verification"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
