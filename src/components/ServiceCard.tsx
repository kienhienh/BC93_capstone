import React from "react";
import type { Service } from "../types/service";

interface Props {
  service: Service;
  onSelect: (id: string) => void;
}

const ServiceCard: React.FC<Props> = ({ service, onSelect }) => {
  return (
    <div
      className="relative w-56 h-80 rounded overflow-hidden shadow-lg flex-shrink-0 cursor-pointer"
      style={{
        backgroundImage: `url(${service.image || "/default-avatar.png"})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onClick={() => onSelect(service.id)}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex flex-col justify-end text-white">
        <p className="text-sm">{service.description}</p>
        <h3 className="text-lg fw-bold">{service.title}</h3>
      </div>
    </div>
  );
};

export default ServiceCard;
