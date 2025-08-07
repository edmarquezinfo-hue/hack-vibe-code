import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPreviewUrl(previewURL?: string, tunnelURL?: string): string {
    return import.meta.env.VITE_PREVIEW_MODE === 'tunnel' ? tunnelURL || previewURL || '' : previewURL || tunnelURL || '';
}