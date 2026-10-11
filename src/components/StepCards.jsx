import React from "react";

const STEPS = [
  {
    icon: "/icons/image.svg",
    hoverBorder: "hover:border-blue-500/30",
    title: "1. Drop Images",
    description:
      "Drag and drop your 360° panoramas or flat images right here. Use `pano` in the name for 360 views.",
  },
  {
    icon: "/icons/map.svg",
    hoverBorder: "hover:border-green-500/30",
    title: "2. Auto-Graph",
    description:
      "The engine automatically builds a walkable spatial map using `{Step}{Branch}-{Turn}` nomenclature.",
  },
  {
    icon: "/icons/layers.svg",
    hoverBorder: "hover:border-purple-500/30",
    title: "3. Immediate Play",
    description:
      "The viewer instantly launches with your files mapped in 3D space, entirely client-side.",
  },
];

export default function StepCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-4 sm:pt-6 pb-6 sm:pb-8 text-left">
      {STEPS.map(({ icon, hoverBorder, title, description }) => (
        <div
          key={title}
          className={`h-full bg-[#1a1d24] p-5 sm:p-6 rounded-xl border border-white/5 ${hoverBorder} transition-colors`}
        >
          <img src={icon} alt={title} className="w-8 h-8 mb-4" />
          <h3 className="font-semibold text-lg mb-2">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      ))}
    </div>
  );
}
