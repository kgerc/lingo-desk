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
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const dropdownEl = dropdownRef.current;
      const dropdownHeight = dropdownEl ? dropdownEl.offsetHeight : 150;
      const dropdownWidth = 192; // 12rem = 192px

      // Use viewport-relative coordinates since we use position: fixed
      let top = triggerRect.bottom + 4;
      let left = triggerRect.right - dropdownWidth;

      // Check if dropdown would go off bottom of screen
      if (triggerRect.bottom + dropdownHeight > window.innerHeight) {
        top = triggerRect.top - dropdownHeight - 4;
      }

      // Check if dropdown would go off left of screen
      if (left < 0) {
        left = triggerRect.left;
      }

      setPosition({ top, left });
    };

    updatePosition();
    // Recalculate after first render to get actual dropdown height
    requestAnimationFrame(updatePosition);
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
      className="fixed w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
      style={{
        top: position ? `${position.top}px` : '-9999px',
        left: position ? `${position.left}px` : '-9999px',
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
