export const IPC_CHANNELS = {
  usageGetSnapshot: "usage.getSnapshot",
  settingsGet: "settings.get",
  settingsUpdate: "settings.update",
  settingsChanged: "settings.changed"
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
