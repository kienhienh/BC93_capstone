import React from "react";
import type { Service } from "../types/service";

interface Props {
  service: Service;
  onSelect: (id: string) => void;
}

const ServiceCard: React.FC<Props> = ({ service, onSelect }) => {
  return (
    <div className="card shadow-sm mb-3">
      <img
        src={service.image && service.image.trim() !== "" ? service.image : "/default-avatar.png"}
        alt={service.title || "default"}
        className="card-img-top"
        style={{ height: "200px", objectFit: "cover" }}
      />

      <div className="card-body">
        <h5 className="card-title">{service.title}</h5>
        <p className="card-text text-muted">{service.description}</p>
        <p className="text-success fw-bold">${service.price}</p>
        <button
          onClick={() => onSelect(service.id)}
          className="btn btn-primary w-100"
        >
          Chọn dịch vụ
        </button>
      </div>
    </div>
  );
};

export default ServiceCard;
