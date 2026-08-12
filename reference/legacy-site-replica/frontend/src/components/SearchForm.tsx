'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SearchFormProps {
  idSuffix?: string;
}

export default function SearchForm({ idSuffix = '0' }: SearchFormProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?s=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form role="search" method="get" className="searchform" onSubmit={handleSubmit}>
      <div className="flex-row relative">
        <div className="flex-col flex-grow">
          <label className="screen-reader-text" htmlFor={`woocommerce-product-search-field-${idSuffix}`}>
            Tìm kiếm:
          </label>
          <input
            type="search"
            id={`woocommerce-product-search-field-${idSuffix}`}
            className="search-field mb-0"
            placeholder="Tìm kiếm sản phẩm..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            name="s"
          />
          <input type="hidden" name="post_type" value="product" />
        </div>
        <div className="flex-col">
          <button
            type="submit"
            value="Tìm kiếm"
            className="ux-search-submit submit-button secondary button icon mb-0"
            aria-label="Submit"
          >
            <i className="icon-search"></i>
          </button>
        </div>
      </div>
      <div className="live-search-results text-left z-top"></div>
    </form>
  );
}
