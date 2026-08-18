import { lazy, Suspense, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ServicePreviewProvider } from "./features/service-preview/wiring";
import { AuthenticationProvider } from "./features/authentication/wiring";
import { AdminRoute } from "./features/authentication/public";
import { composeApplication, type ApplicationComposition } from "./app/composition";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Checkout from "./pages/Checkout";
import Header from "./components/Header";
import Footer from './components/Footer';
import Orders from './pages/Orders';
import PrivateRoute from "./components/PrivateRoute";
import { TaxonomyProvider } from "./features/taxonomy/wiring";
import { ServiceDiscoveryProvider } from "./features/service-discovery/wiring";
import { ServiceDetailProvider } from "./features/service-detail/wiring";
import { CommentSubmissionProvider } from "./features/comment-submission/wiring";
import { HireConfirmationProvider } from "./features/hire-confirmation/wiring";
import { ProfileProvider } from "./features/profile/wiring";

const AdminArea = lazy(() => import("./app/admin-area"));
const ServiceDiscoveryRoute = lazy(() =>
  import("./features/service-discovery/routes").then((m) => ({ default: m.ServiceDiscoveryRoute })),
);
const CategoryLandingRoute = lazy(() =>
  import("./features/taxonomy/routes").then((m) => ({ default: m.CategoryLandingRoute })),
);
const ServiceDetailRoute = lazy(() =>
  import("./features/service-detail/routes").then((m) => ({ default: m.ServiceDetailRoute })),
);
const HireConfirmationRoute = lazy(() =>
  import("./features/hire-confirmation/routes").then((m) => ({ default: m.HireConfirmationRoute })),
);
const HiredServicesRoute = lazy(() =>
  import("./features/hire-confirmation/hired-services-route").then((m) => ({ default: m.HiredServicesRoute })),
);
const ProfileRoute = lazy(() =>
  import("./features/profile/routes").then((m) => ({ default: m.ProfileRoute })),
);
const LoginRoute = lazy(() =>
  import("./features/authentication/routes").then((m) => ({ default: m.LoginRoute })),
);
const RegisterRoute = lazy(() =>
  import("./features/authentication/routes").then((m) => ({ default: m.RegisterRoute })),
);

function AdminLoading() {
  return (
    <main id="main-content" className="authorization-message" aria-busy="true">
      <h1 tabIndex={-1}>Loading Administrator</h1>
      <p role="status">Preparing Administrator workspace...</p>
    </main>
  );
}

function RouteLoading() {
  return (
    <main id="main-content" className="authorization-message" aria-busy="true">
      <h1 tabIndex={-1}>Loading</h1>
      <p role="status">Preparing this page...</p>
    </main>
  );
}

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

  if (composition.ok === false) {
    return <ConfigurationError message={composition.message} />;
  }

  return (
    <QueryClientProvider client={composition.queryClient}>
      <TaxonomyProvider capability={composition.taxonomy}>
        <ServiceDiscoveryProvider capability={composition.serviceDiscovery}>
        <ServiceDetailProvider capability={composition.serviceDetail}>
        <CommentSubmissionProvider capability={composition.commentSubmission}>
        <HireConfirmationProvider capability={composition.hireConfirmation}>
        <ProfileProvider capability={composition.profile}>
        <ServicePreviewProvider capability={composition.servicePreview}>
        <AuthenticationProvider
          capability={composition.authentication}
          sessionStore={composition.sessionStore}
        >
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <div id="application-content">
            <Header />

            <Suspense fallback={<RouteLoading />}>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/categories/:categoryId" element={<CategoryLandingRoute />} />
            <Route path="/services" element={<ServiceDiscoveryRoute />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/services/:serviceId" element={<ServiceDetailRoute />} />
            <Route path="/services/:serviceId/hire" element={<HireConfirmationRoute />} />
            <Route path="/hired-services" element={<HiredServicesRoute />} />
            <Route path="/profile" element={<ProfileRoute />} />

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
                  <Suspense fallback={<AdminLoading />}>
                    <AdminArea config={composition.runtimeConfig} />
                  </Suspense>
                </AdminRoute>
              }
            />
            </Routes>
            </Suspense>

            <Footer />
          </div>
        </AuthenticationProvider>
        </ServicePreviewProvider>
        </ProfileProvider>
        </HireConfirmationProvider>
        </CommentSubmissionProvider>
        </ServiceDetailProvider>
        </ServiceDiscoveryProvider>
      </TaxonomyProvider>
    </QueryClientProvider>
  );
}

export default App;
