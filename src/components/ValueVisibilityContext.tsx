"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "igao-contas:ocultar-valores";

interface ValueVisibilityContextValue {
  ocultar: boolean;
  alternar: () => void;
}

const ValueVisibilityContext = createContext<ValueVisibilityContextValue | null>(null);

export function ValueVisibilityProvider({ children }: { children: ReactNode }) {
  const [ocultar, setOcultar] = useState(false);

  useEffect(() => {
    const salvo = window.localStorage.getItem(STORAGE_KEY);
    if (salvo === "1") setOcultar(true);
  }, []);

  const alternar = () => {
    setOcultar((atual) => {
      const novo = !atual;
      window.localStorage.setItem(STORAGE_KEY, novo ? "1" : "0");
      return novo;
    });
  };

  return (
    <ValueVisibilityContext.Provider value={{ ocultar, alternar }}>
      {children}
    </ValueVisibilityContext.Provider>
  );
}

export function useValueVisibility() {
  const ctx = useContext(ValueVisibilityContext);
  if (!ctx) {
    throw new Error("useValueVisibility precisa estar dentro de ValueVisibilityProvider");
  }
  return ctx;
}
