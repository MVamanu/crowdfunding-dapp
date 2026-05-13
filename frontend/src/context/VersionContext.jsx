import { useState } from "react";
import { VersionContext } from "./version";

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
