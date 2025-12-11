"use client";
import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";

interface Point {
  x: number;
  y: number;
}
interface Stroke {
  points: Point[];
  color?: string;
  width?: number;
}

interface WhiteboardProps {
  width?: number;
  height?: number;
  initialStrokes?: Stroke[];
  onAutosave?: (data: {
    strokes: Stroke[];
    width: number;
    height: number;
    pngDataUrl: string;
  }) => void;
  readOnly?: boolean;
}

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

const Whiteboard = forwardRef(function Whiteboard(
  {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    initialStrokes = [],
    onAutosave,
    readOnly = false,
  }: WhiteboardProps,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(() => (Array.isArray(initialStrokes) ? initialStrokes : []));
  const [drawing, setDrawing] = useState(false);
  const currentStroke = useRef<Stroke | null>(null);

  useEffect(() => {
    setStrokes(Array.isArray(initialStrokes) ? initialStrokes : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStrokes]);

  // Draw all strokes + in-progress
  function drawAll(tempCurrent: Stroke | null = null) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const stroke of strokes) {
      if (!stroke || !stroke.points || stroke.points.length < 2) continue;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = stroke.width || 2;
      ctx.beginPath();
      stroke.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }
    if (tempCurrent && tempCurrent.points.length > 1) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = tempCurrent.width || 2;
      ctx.beginPath();
      tempCurrent.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    }
  }

  useEffect(() => {
    drawAll();
  }, [strokes, width, height]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    if ("touches" in e) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    } else {
      return {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
      };
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getPos(e);
    setDrawing(true);
    currentStroke.current = { points: [pt], color: "#000000", width: 2 };
    drawAll(currentStroke.current);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !currentStroke.current) return;
    e.preventDefault();
    const pt = getPos(e);
    currentStroke.current = {
      ...currentStroke.current,
      points: [...currentStroke.current.points, pt],
    };
    drawAll(currentStroke.current);
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !currentStroke.current) return;
    e.preventDefault();
    setDrawing(false);
    // Copy points array defensively
    const newStroke = {
      ...currentStroke.current,
      points: [...currentStroke.current.points],
    };
    setStrokes(prev => [...prev, newStroke]);
    currentStroke.current = null;
    drawAll();
  };

  function handleMouseDown(e: React.MouseEvent) { startDrawing(e); }
  function handleMouseMove(e: React.MouseEvent) { draw(e); }
  function handleMouseUp(e: React.MouseEvent) { stopDrawing(e); }
  function handleTouchStart(e: React.TouchEvent) { startDrawing(e); }
  function handleTouchMove(e: React.TouchEvent) { draw(e); }
  function handleTouchEnd(e: React.TouchEvent) { stopDrawing(e); }

  useEffect(() => {
    if (!onAutosave) return;
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      const pngDataUrl = canvas ? canvas.toDataURL("image/png") : "";
      onAutosave({ strokes, width, height, pngDataUrl });
    }, 5000);
    return () => clearInterval(interval);
  }, [strokes, width, height, onAutosave]);

  // Expose imperative getCurrentData to the parent
  useImperativeHandle(ref, () => ({
    getCurrentData: () => ({
      strokes,
      width,
      height,
      // Optionally add pngDataUrl if needed here or compute on demand
    }),
    finishStroke: () => {
      if (drawing && currentStroke.current && currentStroke.current.points.length > 1) {
        const newStroke = { ...currentStroke.current, points: [...currentStroke.current.points] };
        setStrokes(prev => [...prev, newStroke]);
        currentStroke.current = null;
        setDrawing(false);
      }
    },
  }), [strokes, width, height, drawing]);

  function clearBoard() {
    setStrokes([]);
    currentStroke.current = null;
    drawAll();
  }

  return (
    <div className="border rounded shadow bg-gray-50 relative w-fit p-2">
      <canvas
        ref={canvasRef}
        width={width} height={height}
        className="border bg-white touch-none cursor-crosshair select-none"
        style={{ width: width, height: height, display: "block" }}
        onMouseDown={!readOnly ? handleMouseDown : undefined}
        onMouseMove={!readOnly ? handleMouseMove : undefined}
        onMouseUp={!readOnly ? handleMouseUp : undefined}
        onMouseLeave={!readOnly ? handleMouseUp : undefined}
        onTouchStart={!readOnly ? handleTouchStart : undefined}
        onTouchMove={!readOnly ? handleTouchMove : undefined}
        onTouchEnd={!readOnly ? handleTouchEnd : undefined}
      />
      {!readOnly && (
        <button type="button" className="absolute right-3 top-3 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200" onClick={clearBoard}>
          Clear
        </button>
      )}
    </div>
  );
});

export default Whiteboard;
