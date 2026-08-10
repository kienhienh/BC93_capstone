import React, { useEffect, useState, useRef } from "react";
import { getJobs } from "../services/api";
import type { Service } from "../types/service";
import ServiceCard from "../components/ServiceCard";
import HeroBanner from "../components/HeroBanner";
import { useNavigate } from "react-router-dom";

const Home: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getJobs()
      .then((data) => setServices(data))
      .catch(() => alert("Không thể tải dữ liệu Service"))
      .finally(() => setLoading(false));
  }, []);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" });

  return (
    <div>
      {/* HeroBanner */}
      <HeroBanner />

      {/* Popular Professional Services */}
      <div className="container mt-5 position-relative">
        <h2 className="fw-bold mb-4">Popular Professional Services</h2>

        {/* Nút trái/phải */}
        <button
          onClick={scrollLeft}
          className="btn btn-light position-absolute top-50 start-0 translate-middle-y shadow"
          style={{ zIndex: 10 }}
        >
          ◀
        </button>
        <button
          onClick={scrollRight}
          className="btn btn-light position-absolute top-50 end-0 translate-middle-y shadow"
          style={{ zIndex: 10 }}
        >
          ▶
        </button>

        {loading ? (
          <p>Đang tải dữ liệu...</p>
        ) : (
          <div ref={scrollRef} className="d-flex overflow-auto gap-3">
            {services.slice(0, 6).map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onSelect={(id) => navigate(`/services/${id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* About Fiverr */}
      <div className="container mt-5 p-5 bg-light rounded">
        <div className="row align-items-center">
          <div className="col-md-6">
            <h3>A whole world of freelance talent at your fingertips</h3>
            <ul className="mt-3">
              <li>The best for every budget</li>
              <li>Quality work done quickly</li>
              <li>Protected payments, every time</li>
              <li>24/7 support</li>
            </ul>
          </div>
          <div className="col-md-6">
            <img src="/images/about.jpg" alt="Freelancers working" className="img-fluid rounded" />
          </div>
        </div>
      </div>

      {/* Testimonial */}
      <div className="container mt-5 text-center">
        <blockquote className="fst-italic">
          “It’s extremely exciting that Fiverr has freelancers from all over the world — it broadens
          the talent pool. One of the best things about Fiverr is that while we’re sleeping,
          someone’s working.”
        </blockquote>
        <p className="fw-semibold mt-2">Kay Kim, Co-Founder of Rooted</p>
      </div>
    </div>
  );
};

export default Home;
