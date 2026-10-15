"use client"

export type PmQrSticker = {
  assetId: string
  name: string
  branchName: string
  typeLabel: string
  dataUrl: string
}

const FONT = "Tahoma, 'Segoe UI', sans-serif"

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("qr"))
    image.src = src
  })
}

function fileName(name: string) {
  const safe = name.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 40) || "pm-qr"
  return `PM-${safe}.png`
}

export async function downloadPmQr(
  sticker: PmQrSticker,
  labels: { branch: string; name: string; type: string; caption: string }
) {
  if (!sticker.dataUrl) return
  const qr = await loadImage(sticker.dataUrl)
  const width = 560
  const qrSize = 360
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = 28 + 34 + 40 + 16 + qrSize + 48
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, canvas.height)
  ctx.strokeStyle = "#e5e7eb"
  ctx.lineWidth = 3
  ctx.strokeRect(6, 6, width - 12, canvas.height - 12)
  ctx.textBaseline = "top"

  const drawLine = (parts: { text: string; font: string; color: string }[], y: number) => {
    const widths = parts.map((part) => {
      ctx.font = part.font
      return ctx.measureText(part.text).width
    })
    let x = (width - widths.reduce((sum, item) => sum + item, 0)) / 2
    ctx.textAlign = "left"
    parts.forEach((part, index) => {
      ctx.font = part.font
      ctx.fillStyle = part.color
      ctx.fillText(part.text, x, y)
      x += widths[index] ?? 0
    })
  }

  const labelFont = `20px ${FONT}`
  const valueFont = `24px ${FONT}`
  const nameFont = `bold 28px ${FONT}`
  drawLine(
    [
      { text: `${labels.branch}  `, font: labelFont, color: "#6b7280" },
      { text: sticker.branchName || "—", font: valueFont, color: "#111827" },
    ],
    24
  )
  drawLine(
    [
      { text: `${labels.name}  `, font: labelFont, color: "#6b7280" },
      { text: sticker.name || "—", font: nameFont, color: "#111827" },
      { text: "    ", font: nameFont, color: "#111827" },
      { text: `${labels.type}  `, font: labelFont, color: "#6b7280" },
      { text: sticker.typeLabel || "—", font: valueFont, color: "#111827" },
    ],
    58
  )

  const qrTop = 108
  ctx.drawImage(qr, (width - qrSize) / 2, qrTop, qrSize, qrSize)
  ctx.textAlign = "center"
  ctx.fillStyle = "#6b7280"
  ctx.font = `20px ${FONT}`
  ctx.fillText(labels.caption, width / 2, qrTop + qrSize + 12)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName(sticker.name)
  link.click()
  URL.revokeObjectURL(url)
}
