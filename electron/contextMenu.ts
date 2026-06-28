type MenuItemLike = {
  label: string;
  click: () => void;
};

type MenuLike = {
  popup: () => void;
};

type MenuFactoryLike = {
  buildFromTemplate: (items: MenuItemLike[]) => MenuLike;
};

type WebContentsLike = {
  on: (event: "context-menu", handler: () => void) => void;
};

export function registerOverlayContextMenu(options: {
  webContents: WebContentsLike;
  menu: MenuFactoryLike;
  openDashboard: () => void;
  openSettings: () => void;
  quit: () => void;
}): void {
  options.webContents.on("context-menu", () => {
    const menu = options.menu.buildFromTemplate([
      { label: "대시 보드", click: options.openDashboard },
      { label: "설정", click: options.openSettings },
      { label: "나가기", click: options.quit }
    ]);
    menu.popup();
  });
}
