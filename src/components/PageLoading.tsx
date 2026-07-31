'use client';

import { LoadingSpinner } from './LoadingSpinner';

export function PageLoading() {
  return (
    <div
      className="page-loading"
      style={{
        height: '100%',
        minHeight: 360,
        display: 'grid',
        placeItems: 'center',
        padding: 28,
      }}
    >
      <LoadingSpinner size={56} />
    </div>
  );
}
