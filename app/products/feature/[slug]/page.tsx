import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { editorials } from "@/data/editorial";
import FeatureHeroLayout from "@/components/FeatureHeroLayout";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return editorials.map((ed) => ({ slug: ed.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const editorial = editorials.find((ed) => ed.slug === slug);
  if (!editorial) return { title: "기획 특집" };
  return {
    title: `${editorial.title} — WORKUP`,
    description: editorial.desc,
  };
}

export default async function FeaturePage({ params }: Props) {
  const { slug } = await params;
  const editorial = editorials.find((ed) => ed.slug === slug);
  if (!editorial) notFound();

  return (
    <main className="bg-white">
      <FeatureHeroLayout editorial={editorial} />
    </main>
  );
}
