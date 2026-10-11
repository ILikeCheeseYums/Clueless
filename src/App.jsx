import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import StreetViewer from "./components/StreetViewer";
import StepCards from "./components/StepCards";
import { parseItem } from "./utils/graph";

export default function App() {
  const [isViewing, setIsViewing] = useState(false);
  const [images, setImages] = useState([]);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const newImages = acceptedFiles.map((file) => {
      const url = URL.createObjectURL(file);
      const parsed = parseItem(file.name);
      parsed.image = url;
      return parsed;
    });

    setImages(newImages);
    setIsViewing(true);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
  });

  // Render the standalone Viewer Tool
  if (isViewing) {
    return <StreetViewer images={images} onExit={() => setIsViewing(false)} />;
  }

  // Render the Landing / Home Page
  return (
    <div
      {...getRootProps()}
      className={`min-h-screen bg-[#0b0c0e] text-white flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12 relative transition-colors ${isDragActive ? "bg-[#1a1d24]" : ""}`}
    >
      <input {...getInputProps()} />

      {/* Decorative background grid */}
      <div
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#20232a 1px, transparent 1px), linear-gradient(90deg, #20232a 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-[#1a73e8]/20 backdrop-blur-sm border-4 border-dashed border-[#1a73e8] flex items-center justify-center">
          <h2 className="text-4xl font-bold text-white">
            Drop images here to launch!
          </h2>
        </div>
      )}

      <div className="relative z-10 w-full max-w-5xl text-center space-y-6 sm:space-y-8 pointer-events-auto">
        <div className="flex justify-center">
          <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <img src="/icons/compass.svg" alt="Compass" className="w-16 h-16" />
          </div>
        </div>

        <h1 className="text-4xl leading-tight sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#8ab4f8] to-[#1a73e8]">
          Immersia 3D Engine
        </h1>

        <p className="text-gray-400 text-base sm:text-lg lg:text-xl leading-relaxed max-w-full mx-auto">
          Create, navigate, and embed your own 3D virtual tours. Simply drop
          your nomenclature-formatted images anywhere on this page and instantly
          build a walkable spatial graph.
        </p>

        <StepCards />

        <div className="flex justify-center pt-1 pointer-events-auto">
          <button
            type="button"
            className="group relative max-w-full px-6 py-4 sm:px-10 bg-[#1a73e8] hover:bg-[#1557b0] transition-all rounded-full font-bold text-base sm:text-xl"
          >
            <span className="flex items-center gap-3">
              <img src="/icons/upload-cloud.svg" alt="Upload" className="w-5 h-5 group-hover:-translate-y-1 transition-transform duration-300" />
              <span className="text-center">Select Images or Drop Here</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
