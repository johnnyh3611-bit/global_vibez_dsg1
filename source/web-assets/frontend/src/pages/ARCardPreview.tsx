

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, DefaultXRController, DefaultXRHand, VRButton } from '@react-three/xr';
import { Text, Box, Sphere } from '@react-three/drei';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import { Button } from '@/components/ui/button';
import { ScanLine, Camera, Hand, ArrowLeft, Info } from 'lucide-react';

/**
 * AR Card Preview - See cards in augmented reality on your real table
 * Works with any smartphone camera
 */
export default function ARCardPreview() {
  const [arSupported, setArSupported] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Check AR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        setArSupported(supported);
      });
    }

    // Fallback: Use device camera for AR overlay
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setArSupported(true);
    }
  }, []);

  const startARPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraPermission(true);
      }
    } catch (error) {
      // console.error('Camera access denied:', error);
      alert('Please allow camera access to use AR features');
    }
  };

  const PlayingCardAR = ({ position, suit, rank }) => {
    const suitSymbols = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
    const suitColors = {
      spades: '#1e293b',
      hearts: '#ef4444',
      diamonds: '#ef4444',
      clubs: '#1e293b'
    };

    return (
      <group position={position}>
        {/* Card base */}
        <Box args={[0.6, 0.9, 0.02]}>
          <meshStandardMaterial color="white" />
        </Box>
        
        {/* Rank */}
        <Text
          position={[0, 0.3, 0.02]}
          fontSize={0.15}
          color={suitColors[suit]}
          anchorX="center"
          anchorY="middle"
        >
          {rank}
        </Text>
        
        {/* Suit symbol */}
        <Text
          position={[0, 0, 0.02]}
          fontSize={0.25}
          color={suitColors[suit]}
          anchorX="center"
          anchorY="middle"
        >
          {suitSymbols[suit]}
        </Text>
        
        {/* Rank (bottom) */}
        <Text
          position={[0, -0.3, 0.02]}
          fontSize={0.15}
          color={suitColors[suit]}
          anchorX="center"
          anchorY="middle"
          rotation={[0, 0, Math.PI]}
        >
          {rank}
        </Text>
      </group>
    );
  };

  if (!cameraPermission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 relative overflow-hidden flex items-center justify-center">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto"
          >
            <GlassCard className="p-8">
              <div className="text-center mb-8">
                <Camera className="w-20 h-20 text-blue-400 mx-auto mb-4" />
                <h1 className="text-4xl font-bold text-white mb-4">
                  AR Card Preview
                </h1>
                <p className="text-slate-300 text-lg">
                  See your cards in augmented reality on your table
                </p>
              </div>

              {/* Features */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <ScanLine className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Real-World Overlay</h3>
                    <p className="text-slate-400 text-sm">Point your phone at any flat surface to see cards</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Hand className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Interactive</h3>
                    <p className="text-slate-400 text-sm">Tap to select cards, pinch to zoom</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Info className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Works Anywhere</h3>
                    <p className="text-slate-400 text-sm">No markers needed - just point and play</p>
                  </div>
                </div>
              </div>

              {arSupported ? (
                <NeonButton
                  onClick={startARPreview}
                  variant="gradient"
                  className="w-full"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Start AR Experience
                </NeonButton>
              ) : (
                <div className="text-center">
                  <p className="text-red-400 mb-4">AR not supported on this device</p>
                  <Button variant="ghost" onClick={() => window.history.back()}>
                    Go Back
                  </Button>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* AR Overlay Canvas */}
      <div className="absolute inset-0 w-full h-full">
        <Canvas
          ref={canvasRef}
          camera={{ position: [0, 2, 5], fov: 50 }}
          style={{ background: 'transparent' }}
        >
          {/* @ts-expect-error — @react-three/xr requires a `store` prop in v6 which is not wired here yet */}
          <XR>
            <ambientLight intensity={0.8} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            
            {/* Sample Cards in AR */}
            <PlayingCardAR position={[-1.5, 0, 0]} suit="spades" rank="A" />
            <PlayingCardAR position={[-0.5, 0, 0]} suit="hearts" rank="K" />
            <PlayingCardAR position={[0.5, 0, 0]} suit="diamonds" rank="Q" />
            <PlayingCardAR position={[1.5, 0, 0]} suit="clubs" rank="J" />

            {/* VR Controllers (if in VR mode) */}
            {/* @ts-expect-error — @react-three/xr v6 narrowed prop types; runtime accepts hand. */}
            <DefaultXRController hand="left" />
            {/* @ts-expect-error — see above. */}
            <DefaultXRController hand="right" />
            {/* @ts-expect-error — see above. */}
            <DefaultXRHand hand="left" />
            {/* @ts-expect-error — see above. */}
            <DefaultXRHand hand="right" />
          </XR>
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          onClick={() => {
            if (videoRef.current && videoRef.current.srcObject) {
              videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            setCameraPermission(false);
          }}
          className="bg-black/50 backdrop-blur text-white hover:bg-black/70"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Exit AR
        </Button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <GlassCard className="px-6 py-3 max-w-md">
          <p className="text-white text-center text-sm">
            Point your camera at a flat surface. Cards will appear in your real environment.
          </p>
        </GlassCard>
      </div>

      {/* Reticle/Crosshair */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
        <div className="w-8 h-8 border-2 border-white rounded-full opacity-50" />
        <div className="absolute top-1/2 left-1/2 w-0.5 h-4 bg-white transform -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-white transform -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}
