"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { X } from "lucide-react"

interface ClickableImageProps {
  src: string
  alt?: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  sizes?: string
}

export function ClickableImage({ src, alt = "Image", fill, width, height, className, sizes }: ClickableImageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [thumbFailed, setThumbFailed] = useState(false)
  const [overlayFailed, setOverlayFailed] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const overlay =
    mounted &&
    isOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-8 backdrop-blur-sm cursor-zoom-out"
        onClick={() => setIsOpen(false)}
        role="presentation"
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-white/70 hover:text-white bg-black/50 rounded-full hover:bg-black/70 transition-colors z-50 cursor-pointer"
          aria-label="ปิด"
        >
          <X className="w-6 h-6 md:w-8 md:h-8" />
        </button>

        <div className="relative w-full h-[80vh] flex items-center justify-center">
          {overlayFailed ? (
            <img src={src} alt={alt} className="max-h-[80vh] max-w-full object-contain drop-shadow-2xl" />
          ) : (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              className="object-contain drop-shadow-2xl"
              priority
              unoptimized
              onError={() => setOverlayFailed(true)}
            />
          )}
        </div>
      </div>,
      document.body
    )

  return (
    <>
      {thumbFailed ? (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={`cursor-zoom-in ${className || ""}`}
          onClick={() => setIsOpen(true)}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          width={width}
          height={height}
          sizes={sizes}
          className={`cursor-zoom-in ${className || ""}`}
          onClick={() => setIsOpen(true)}
          unoptimized
          onError={() => setThumbFailed(true)}
        />
      )}
      {overlay}
    </>
  )
}
