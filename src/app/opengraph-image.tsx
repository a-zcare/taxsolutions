import { ImageResponse } from 'next/og';
export const alt = 'TaxSolutions — Accounting & Tax';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#EFF6FF',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 90,
        color: '#123B70',
      }}
    >
      <div style={{ fontSize: 76, fontWeight: 700, display: 'flex' }}>
        TaxSolutions
      </div>
      <div style={{ fontSize: 30, marginTop: 30, display: 'flex' }}>
        Accounting & Tax · LV / EN / RU
      </div>
      <div
        style={{
          fontSize: 24,
          marginTop: 70,
          display: 'flex',
          color: '#2563EB',
        }}
      >
        Clarity in numbers. Confidence in decisions.
      </div>
    </div>,
    size,
  );
}
