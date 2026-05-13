import { createContext, useContext } from "react";

export const VersionContext = createContext("v1");

export function useVersion() {
  return useContext(VersionContext);
}
