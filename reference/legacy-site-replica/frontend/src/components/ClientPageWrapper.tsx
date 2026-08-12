'use client';

import React from 'react';
import Header from './Header';
import Footer from './Footer';
import ClientPage, { SafeHTML } from './ClientPage';

interface ClientPageWrapperProps {
  data: {
    beforeHeader: string;
    content: string;
    afterFooter: string;
    bodyClass: string;
  };
}

export default function ClientPageWrapper({ data }: ClientPageWrapperProps) {
  return (
    <div id="original-content">
      {/* Before Header Content */}
      <SafeHTML html={data.beforeHeader} />

      <Header />

      {/* Main Body Content */}
      <div dangerouslySetInnerHTML={{ __html: data.content }} suppressHydrationWarning={true} />

      <Footer />

      {/* After Footer Content */}
      <SafeHTML html={data.afterFooter} />

      {/* Client-side initialization */}
      <ClientPage bodyClass={data.bodyClass} />
    </div>
  );
}
