import React from 'react';
import { getPageData } from '@/utils/pageParser';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ClientPageContent from '@/components/ClientPageContent';

interface PageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const slugStr = slug.join('/');
  const data = await getPageData(slugStr);
  
  if (!data) {
    return {
      title: 'Page Not Found - Giacong.vn',
      description: 'The page you are looking for does not exist.',
    };
  }

  return {
    title: data.title || 'Giacong.vn',
    description: data.description || '',
  };
}

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;
  const slugStr = slug.join('/');
  const data = await getPageData(slugStr);
  
  if (!data) {
    return notFound();
  }

  return <ClientPageContent data={data} />;
}
