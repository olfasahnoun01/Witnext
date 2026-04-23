import { DriverMobileView } from "@/components/vehicules/DriverMobileView";
import { ProtectedRoute } from "@/App";

const DriverHub = () => {
  return (
    <ProtectedRoute>
      <DriverMobileView />
    </ProtectedRoute>
  );
};

export default DriverHub;
