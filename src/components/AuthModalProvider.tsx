import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Modal } from "reshaped";
import SignInFlow from "./SignInFlow";

interface AuthModalContextValue {
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export const useAuthModal = () => useContext(AuthModalContext);

export default function AuthModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [active, setActive] = useState(false);

  const openAuthModal = useCallback(() => setActive(true), []);
  const closeAuthModal = useCallback(() => setActive(false), []);

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal }}>
      {children}
      <Modal
        active={active}
        onClose={closeAuthModal}
        position="center"
        padding={6}
      >
        <SignInFlow onSuccess={closeAuthModal} />
      </Modal>
    </AuthModalContext.Provider>
  );
}
