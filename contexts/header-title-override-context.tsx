import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type HeaderTitleOverrideContextValue = {
  title: string | null;
  setTitle: (value: string | null) => void;
};

const HeaderTitleOverrideContext =
  createContext<HeaderTitleOverrideContextValue | null>(null);

export function HeaderTitleOverrideProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState<string | null>(null);
  const setTitle = useCallback((value: string | null) => {
    setTitleState(value?.trim() ? value.trim() : null);
  }, []);
  const value = useMemo(() => ({ title, setTitle }), [title, setTitle]);
  return (
    <HeaderTitleOverrideContext.Provider value={value}>
      {children}
    </HeaderTitleOverrideContext.Provider>
  );
}

export function useHeaderTitleOverride(): HeaderTitleOverrideContextValue {
  const ctx = useContext(HeaderTitleOverrideContext);
  if (!ctx) {
    throw new Error("useHeaderTitleOverride requires HeaderTitleOverrideProvider");
  }
  return ctx;
}

export function useHeaderTitleOverrideOptional(): HeaderTitleOverrideContextValue | null {
  return useContext(HeaderTitleOverrideContext);
}
