import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { editorials } from "@/data/editorial";
import FeatureHeroLayout from "@/components/FeatureHeroLayout";
import { pageMetadata } from "@/lib/seo";
import { isProductsHidden } from "@/lib/header-nav-server";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return editorials.map((ed) => ({ slug: ed.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const editorial = editorials.find((ed) => ed.slug === slug);
  if (!editorial) return { title: "기획 특집" };
  return pageMetadata({
    title: editorial.title,
    description: editorial.desc,
    path: `/products/feature/${slug}`,
    noindex: await isProductsHidden(),
  });
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
