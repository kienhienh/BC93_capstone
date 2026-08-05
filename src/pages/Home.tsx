import React, { useEffect, useState } from "react";
import { getJobs } from "../services/api";
import type { Service } from "../types/service";
import ServiceCard from "../components/ServiceCard";
import HeroBanner from "../components/HeroBanner";
import { useNavigate } from "react-router-dom";

const Home: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getJobs()
      .then(setServices)
      .catch(() => alert("Không thể tải dữ liệu công việc"));
  }, []);

  return (
    <div>
      <HeroBanner />
      <div className="container mt-4">
        <h2 className="mb-4">Dịch vụ nổi bật</h2>
        <div className="row">
          {services.slice(0, 6).map((service) => (
            <div key={service.id} className="col-md-4">
              <ServiceCard
                service={service}
                onSelect={(id) => navigate(`/JobDetail/${id}`)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
