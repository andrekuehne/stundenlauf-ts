import type { CSSProperties, ReactNode } from "react";

type ContentSplitLayoutProps = {
  header?: ReactNode;
  main: ReactNode;
  side?: ReactNode;
  sideWidth?: number;
  fillHeight?: boolean;
  stickySide?: boolean;
};

export function ContentSplitLayout({
  header,
  main,
  side,
  sideWidth = 360,
  fillHeight = false,
  stickySide = false,
}: ContentSplitLayoutProps) {
  const gridStyle = {
    "--content-split-side-width": `${sideWidth}px`,
  } as CSSProperties;
  const rootClass = `content-split-layout ${fillHeight ? "content-split-layout--fill" : ""}`.trim();
  const sideClass = `content-split-layout__side ${stickySide ? "content-split-layout__side--sticky" : ""}`.trim();

  return (
    <div className={rootClass}>
      {header ? <div className="content-split-layout__header">{header}</div> : null}
      <div className="content-split-layout__grid" style={gridStyle}>
        <main className="content-split-layout__main">{main}</main>
        {side ? <aside className={sideClass}>{side}</aside> : null}
      </div>
    </div>
  );
}
