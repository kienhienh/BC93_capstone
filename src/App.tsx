import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Hire from "./pages/Hire";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HiredServices from "./pages/HiredServices";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Jobs />} />
        <Route path="/services/:id" element={<JobDetail />} />
        <Route path="/jobs" element={<Navigate to="/services" replace />} />
        <Route path="/jobdetail/:id" element={<JobDetail />} />

        <Route
          path="/hire/:id"
          element={
            <PrivateRoute>
              <Hire />
            </PrivateRoute>
          }
        />
        <Route
          path="/hired-services"
          element={
            <PrivateRoute>
              <HiredServices />
            </PrivateRoute>
          }
        />
        <Route path="/checkout/:id" element={<Navigate to="/services" replace />} />
        <Route path="/orders" element={<Navigate to="/hired-services" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>

      <Footer />
    </>
  );
}

export default App;
