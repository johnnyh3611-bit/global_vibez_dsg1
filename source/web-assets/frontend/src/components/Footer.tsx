import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="w-full bg-gradient-to-b from-gray-900 to-black border-t border-purple-500/20 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-gray-400 text-sm">
            Powered by{' '}
            <span className="text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text font-bold">
              H&S Solutions Group
            </span>
          </p>
          <p className="text-gray-500 text-xs">
            © {currentYear} Global Vibez DSG. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
