// src/components/ui/input.tsx

import React from 'react';

interface InputProps {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean; 
}


const Input: React.FC<InputProps> = ({ value, onChange, placeholder, onKeyDown, disabled }) => {
  return (
    <input
      type="text"
      value={value}
      tabIndex={0} 
      onChange={onChange}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      disabled={disabled} 
      className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
};

export { Input };
