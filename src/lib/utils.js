import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Magic UI components import `cn` from this exact path.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
