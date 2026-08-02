import React, { useState, useRef, useCallback, useEffect } from "react";
import { GripVertical } from "lucide-react";

interface ResizableSplitPanelProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftWidthPercent?: number;
  minLeftWidthPercent?: number;
  maxLeftWidthPercent?: number;
  className?: string;
}

export default function ResizableSplitPanel({
  left,
  right,
  initialLeftWidthPercent = 42,
  minLeftWidthPercent = 25,
  maxLeftWidthPercent = 75,
  className = "",
}: ResizableSplitPanelProps) {
  const [leftWidthPercent, setLeftWidthPercent] = useState(initialLeftWidthPercent);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const newPercent = (relativeX / rect.width) * 100;
      const clamped = Math.max(minLeftWidthPercent, Math.min(maxLeftWidthPercent, newPercent));
      setLeftWidthPercent(clamped);
    },
    [minLeftWidthPercent, maxLeftWidthPercent]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    };

    const onMouseUp = () => setIsDragging(false);
    const onTouchEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, handleMove]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col lg:flex-row w-full select-none ${isDragging ? "cursor-col-resize" : ""} ${className}`}
    >
      {/* Left Panel */}
      <div
        className="w-full lg:w-auto flex-shrink-0 transition-all duration-75"
        style={{
          width: window.innerWidth >= 1024 ? `${leftWidthPercent}%` : "100%",
        }}
      >
        {left}
      </div>

      {/* Draggable Vertical Splitter Bar (visible on LG screens) */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`hidden lg:flex items-center justify-center w-4 hover:w-5 -mx-2 z-20 cursor-col-resize group transition-all ${
          isDragging ? "w-5" : ""
        }`}
        title="Drag to resize panels"
      >
        <div
          className={`h-24 w-1.5 rounded-full border transition-all flex items-center justify-center ${
            isDragging
              ? "bg-cyan-400 border-cyan-300 shadow-lg shadow-cyan-500/50"
              : "bg-white/10 border-white/20 group-hover:bg-cyan-500/50 group-hover:border-cyan-400/80"
          }`}
        >
          <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-cyan-200" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full flex-1 min-w-0 transition-all duration-75">
        {right}
      </div>
    </div>
  );
}
