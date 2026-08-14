import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ServicePreviewProvider } from "./features/service-preview/wiring";
import { AuthenticationProvider } from "./features/authentication/wiring";
import { AdminRoute, LoginRoute, RegisterRoute } from "./features/authentication/public";
import { composeApplication, type ApplicationComposition } from "./app/composition";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Checkout from "./pages/Checkout";
import Header from "./components/Header";
import Footer from './components/Footer';
import Orders from './pages/Orders';
import PrivateRoute from "./components/PrivateRoute";
import Admin from "./pages/Admin";
import { ServiceDiscoveryRoute } from "./features/service-discovery/public";
import { CategoryLandingRoute } from "./features/taxonomy/public";
import { TaxonomyProvider } from "./features/taxonomy/wiring";
import { ServiceDiscoveryProvider } from "./features/service-discovery/wiring";
import { ServiceDetailProvider } from "./features/service-detail/wiring";
import { ServiceDetailRoute } from "./features/service-detail/public";
import { CommentSubmissionProvider } from "./features/comment-submission/wiring";
import { HireConfirmationProvider } from "./features/hire-confirmation/wiring";
import { HiredServicesRoute, HireConfirmationRoute } from "./features/hire-confirmation/public";

function ConfigurationError({ message }: { message: string }) {
  return (
    <main className="configuration-error">
      <h1>Application unavailable</h1>
      <p role="alert">{message}</p>
    </main>
  );
}

function App({ composition: suppliedComposition }: { composition?: ApplicationComposition }) {
  const [composition] = useState(
    () =>
      suppliedComposition ??
      composeApplication({
        mode: import.meta.env.MODE === "test" ? "test" : "production",
        environment: import.meta.env,
      }),
  );

  if (!composition.ok) {
    return <ConfigurationError message={composition.message} />;
  }

  return (
    <QueryClientProvider client={composition.queryClient}>
      <TaxonomyProvider capability={composition.taxonomy}>
        <ServiceDiscoveryProvider capability={composition.serviceDiscovery}>
        <ServiceDetailProvider capability={composition.serviceDetail}>
        <CommentSubmissionProvider capability={composition.commentSubmission}>
        <HireConfirmationProvider capability={composition.hireConfirmation}>
        <ServicePreviewProvider capability={composition.servicePreview}>
        <AuthenticationProvider
          capability={composition.authentication}
          sessionStore={composition.sessionStore}
        >
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <div id="application-content">
            <Header />

            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/categories/:categoryId" element={<CategoryLandingRoute />} />
            <Route path="/services" element={<ServiceDiscoveryRoute />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/services/:serviceId" element={<ServiceDetailRoute />} />
            <Route path="/services/:serviceId/hire" element={<HireConfirmationRoute />} />
            <Route path="/hired-services" element={<HiredServicesRoute />} />

            <Route
              path="/checkout/:id"
              element={
                <PrivateRoute>
                  <Checkout />
                </PrivateRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <PrivateRoute>
                  <Orders />
                </PrivateRoute>
              }
            />

            <Route path="/login" element={<LoginRoute />} />
            <Route path="/register" element={<RegisterRoute />} />
            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
            </Routes>

            <Footer />
          </div>
        </AuthenticationProvider>
        </ServicePreviewProvider>
        </HireConfirmationProvider>
        </CommentSubmissionProvider>
        </ServiceDetailProvider>
        </ServiceDiscoveryProvider>
      </TaxonomyProvider>
    </QueryClientProvider>
  );
}

export default App;
