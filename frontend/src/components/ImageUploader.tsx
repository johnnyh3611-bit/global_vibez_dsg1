
import { useState, useRef } from 'react';
import { Image, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ImageUploader({ onSend, onCancel }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if (!imagePreview) return;
    
    // Send base64 image
    onSend(imagePreview);
    
    // Cleanup
    setSelectedImage(null);
    setImagePreview('');
  };

  const handleCancel = () => {
    setSelectedImage(null);
    setImagePreview('');
    onCancel();
  };

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">📸 Send Image</h3>
        <button onClick={handleCancel} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {!imagePreview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-cyan-500/30 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400/50 hover:bg-white/5 transition-all"
        >
          <Upload className="w-12 h-12 text-cyan-400 mb-4" />
          <p className="text-white font-semibold mb-2">Click to upload image</p>
          <p className="text-gray-400 text-sm">PNG, JPG, GIF up to 5MB</p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-96 object-contain bg-black/40"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 border-gray-600 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              <Image className="w-4 h-4 mr-2" />
              Send Image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
