import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DropdownItem {
  label: string;
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  items: DropdownItem[];
  triggerRef: React.RefObject<HTMLElement>;
}

const Dropdown: React.FC<DropdownProps> = ({ isOpen, onClose, items, triggerRef }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 200; // Approximate max height
      const dropdownWidth = 192; // 12rem = 192px

      let top = triggerRect.bottom + window.scrollY + 8; // 8px gap
      let left = triggerRect.right + window.scrollX - dropdownWidth;

      // Check if dropdown would go off bottom of screen
      if (triggerRect.bottom + dropdownHeight > window.innerHeight) {
        top = triggerRect.top + window.scrollY - dropdownHeight - 8;
      }

      // Check if dropdown would go off left of screen
      if (left < 0) {
        left = triggerRect.left + window.scrollX;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          disabled={item.disabled}
          className={
            item.className ||
            `w-full text-left px-4 py-2 text-sm transition-colors ${
              item.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : item.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-100'
            } ${index === 0 ? 'rounded-t-lg' : ''} ${
              index === items.length - 1 ? 'rounded-b-lg' : ''
            }`
          }
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
};

export default Dropdown;
