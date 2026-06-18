// QR generation is rarely used and pulls a library, so load it on demand.
export async function makeQrDataUrl(text) {
  const QR = await import('qrcode')
  const toDataURL = QR.toDataURL || QR.default?.toDataURL
  return toDataURL(text, { width: 240, margin: 1, color: { dark: '#2B2724', light: '#ffffff' } })
}
