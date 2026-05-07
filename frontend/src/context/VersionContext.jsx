import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

export const VersionContext = createContext("v1");

export function VersionProvider({ children }) {
  const [version, setVersion] = useState(
    localStorage.getItem("fundchain_version") || "v1"
  );

  function switchVersion(v) {
    setVersion(v);
    localStorage.setItem("fundchain_version", v);
  }

  return (
    <VersionContext.Provider value={{ version, switchVersion }}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  return useContext(VersionContext);
}
