import type { WindowKind } from "./windowConfig.js";

export type RegistryWindowLike = {
  webContents: {
    id: number;
  };
  on: (event: "closed", handler: () => void) => void;
};

export function registerWindowKind(senderKinds: Map<number, WindowKind>, window: RegistryWindowLike, kind: WindowKind): void {
  const senderId = window.webContents.id;
  senderKinds.set(senderId, kind);
  window.on("closed", () => {
    senderKinds.delete(senderId);
  });
}
