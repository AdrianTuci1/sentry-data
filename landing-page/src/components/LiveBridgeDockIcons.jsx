function IconBase({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function PlusIcon({ size }) {
  return (
    <IconBase size={size}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  )
}

export function XIcon({ size }) {
  return (
    <IconBase size={size}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  )
}

export function MicIcon({ size }) {
  return (
    <IconBase size={size}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 10.5a7 7 0 0 0 14 0" />
      <path d="M12 18.5v3" />
      <path d="M8.5 21.5h7" />
    </IconBase>
  )
}

export function ArrowUpIcon({ size }) {
  return (
    <IconBase size={size}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </IconBase>
  )
}

export function BrainCircuitIcon({ size }) {
  return (
    <IconBase size={size}>
      <path d="M8.5 6.5A3.5 3.5 0 1 1 12 3v18" />
      <path d="M15.5 6.5A3.5 3.5 0 1 0 12 3" />
      <path d="M8.5 17.5A3.5 3.5 0 1 1 12 21" />
      <path d="M15.5 17.5A3.5 3.5 0 1 0 12 21" />
      <path d="M8.5 8.5h3.5" />
      <path d="M12 12h4" />
      <path d="M8.5 15.5H12" />
      <circle cx="17.5" cy="12" r="1.5" />
    </IconBase>
  )
}
