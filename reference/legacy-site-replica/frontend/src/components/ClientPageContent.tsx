'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const ClientPageWrapper = dynamic(() => import('./ClientPageWrapper'), { ssr: false });

interface ClientPageContentProps {
  data: {
    beforeHeader: string;
    content: string;
    afterFooter: string;
    bodyClass: string;
  };
}

export default function ClientPageContent({ data }: ClientPageContentProps) {
  return <ClientPageWrapper data={data} />;
}
