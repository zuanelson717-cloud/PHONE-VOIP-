import React, { useRef, useState } from 'react';
import { User } from 'lucide-react';

export function ProfileButton() {
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-10 h-10 rounded-full border-2 border-cyan-500 overflow-hidden flex items-center justify-center bg-slate-800"
      >
        {image ? (
          <img src={image} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-cyan-400" />
        )}
      </button>
    </>
  );
}
