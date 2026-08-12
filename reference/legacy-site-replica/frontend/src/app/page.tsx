import React from 'react';
import { getPageData } from '@/utils/pageParser';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ClientPageContent from '@/components/ClientPageContent';

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPageData('home');
  return {
    title: data?.title || 'Giacong.vn - Đối Tác Gia Công OEM/ODM & Private Label Hàng Đầu',
    description: data?.description || '',
  };
}

export default async function HomePage() {
  const data = await getPageData('home');

  if (!data) {
    return notFound();
  }

  return <ClientPageContent data={data} />;
}
