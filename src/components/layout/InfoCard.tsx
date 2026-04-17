import type { ReactNode } from "react";

type InfoCardProps = {
  title: string;
  children: ReactNode;
};

export function InfoCard({ title, children }: InfoCardProps) {
  return (
    <section className="info-card">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}
