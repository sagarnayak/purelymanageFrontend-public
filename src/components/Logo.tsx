export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#6366f1"/>
      <rect x="8" y="12" width="24" height="16" rx="2" fill="#4f46e5"/>
      <path d="M8 15L20 22L32 15" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
